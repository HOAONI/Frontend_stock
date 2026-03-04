import type { AxiosError } from 'axios'
import type {
  TradingOrdersResponse,
  TradingPerformanceResponse,
  TradingPositionsResponse,
  TradingSummaryResponse,
  TradingTradesResponse,
} from '@/types/trading-account'
import {
  getTradingAccountSummary,
  getTradingOrders,
  getTradingPerformance,
  getTradingPositions,
  getTradingTrades,
} from '@/api/trading-account'

interface TradingAccountState {
  loadingOverview: boolean
  loadingDetails: boolean
  overviewError: string
  detailsError: string
  currentBrokerAccountId: number | null
  summary: TradingSummaryResponse | null
  performance: TradingPerformanceResponse | null
  positions: TradingPositionsResponse | null
  orders: TradingOrdersResponse | null
  trades: TradingTradesResponse | null
  lastLoadedAt: string
  overviewRequestId: number
  detailsRequestId: number
}

interface HomeActivityItem {
  id: string
  stockCode: string
  direction: string
  quantity: string
  status: string
  time: string
}

function parseNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    return null
  return parsed
}

function pickField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim() !== '')
      return value
  }
  return null
}

function formatActivityValue(value: unknown, fallback = '--'): string {
  if (value == null)
    return fallback
  if (typeof value === 'number' && Number.isFinite(value))
    return String(value)
  const text = String(value).trim()
  return text || fallback
}

function normalizeActivityItem(row: Record<string, unknown>, index: number, type: 'order' | 'trade'): HomeActivityItem {
  const stockCode = formatActivityValue(pickField(row, ['stockCode', 'stock_code', 'symbol', 'ticker', 'code', 'security_code']))
  const direction = formatActivityValue(pickField(row, ['direction', 'side', 'action', 'order_side']), type === 'order' ? '委托' : '成交')
  const quantity = formatActivityValue(pickField(row, ['quantity', 'qty', 'volume', 'filledQuantity', 'filled_qty', 'filled_volume']))
  const status = formatActivityValue(pickField(row, ['status', 'orderStatus', 'state', 'tradeStatus']), type === 'order' ? '已提交' : '已成交')
  const time = formatActivityValue(pickField(row, ['submittedAt', 'createdAt', 'updatedAt', 'time', 'orderTime', 'tradeTime', 'executedAt']))
  const id = formatActivityValue(pickField(row, ['orderId', 'order_id', 'tradeId', 'id']), `${type}-${index}`)
  return {
    id,
    stockCode,
    direction,
    quantity,
    status,
    time,
  }
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

export const useTradingAccountStore = defineStore('trading-account-store', {
  state: (): TradingAccountState => ({
    loadingOverview: false,
    loadingDetails: false,
    overviewError: '',
    detailsError: '',
    currentBrokerAccountId: null,
    summary: null,
    performance: null,
    positions: null,
    orders: null,
    trades: null,
    lastLoadedAt: '',
    overviewRequestId: 0,
    detailsRequestId: 0,
  }),
  getters: {
    hasData(state): boolean {
      return Boolean(state.summary || state.performance || state.positions || state.orders || state.trades)
    },
    kpiMetrics(state): {
      totalAsset: number | null
      cash: number | null
      marketValue: number | null
      pnlDaily: number | null
      pnlTotal: number | null
      returnPct: number | null
    } {
      const summary = state.summary?.summary || {}
      const performance = state.performance?.performance || {}

      const pick = (...values: unknown[]) => {
        for (const value of values) {
          const parsed = parseNumber(value)
          if (parsed != null)
            return parsed
        }
        return null
      }

      return {
        totalAsset: pick(performance.totalAsset, summary.totalAsset, summary.totalEquity),
        cash: pick(performance.cash, summary.cash, summary.availableCash),
        marketValue: pick(performance.marketValue, summary.marketValue, summary.totalMarketValue),
        pnlDaily: pick(performance.pnlDaily, summary.pnlDaily, summary.dailyPnl, summary.todayPnl),
        pnlTotal: pick(performance.pnlTotal, summary.pnlTotal, summary.totalPnl, summary.profitTotal),
        returnPct: pick(performance.returnPct, summary.returnPct, summary.totalReturnPct, summary.profitRate),
      }
    },
    recentOrders(state): Array<Record<string, unknown>> {
      return (state.orders?.items || []).slice(0, 5)
    },
    recentTrades(state): Array<Record<string, unknown>> {
      return (state.trades?.items || []).slice(0, 5)
    },
    homeSnapshot(state): {
      brokerAccountId: number | null
      accountLabel: string
      providerLabel: string
      dataSource: string
      snapshotAt: string
      isReady: boolean
    } {
      const meta = state.performance || state.summary || state.positions || state.orders || state.trades
      return {
        brokerAccountId: meta?.brokerAccountId || state.currentBrokerAccountId || null,
        accountLabel: meta?.accountDisplayName || meta?.accountUid || '--',
        providerLabel: meta?.providerName || meta?.providerCode || '--',
        dataSource: meta?.dataSource || '--',
        snapshotAt: state.lastLoadedAt || meta?.snapshotAt || '',
        isReady: Boolean(meta),
      }
    },
    homeKpis(): {
      totalAsset: number | null
      cash: number | null
      marketValue: number | null
      pnlDaily: number | null
      pnlTotal: number | null
      returnPct: number | null
    } {
      return this.kpiMetrics
    },
    homeRecentOrders(state): HomeActivityItem[] {
      return (state.orders?.items || [])
        .slice(0, 5)
        .map((item, index) => normalizeActivityItem(item, index, 'order'))
    },
    homeRecentTrades(state): HomeActivityItem[] {
      return (state.trades?.items || [])
        .slice(0, 5)
        .map((item, index) => normalizeActivityItem(item, index, 'trade'))
    },
  },
  actions: {
    clearData() {
      this.currentBrokerAccountId = null
      this.summary = null
      this.performance = null
      this.positions = null
      this.orders = null
      this.trades = null
      this.lastLoadedAt = ''
      this.overviewError = ''
      this.detailsError = ''
    },

    async loadOverview(options: {
      refresh?: boolean
    }): Promise<{ success: boolean, error?: string }> {
      const requestId = this.overviewRequestId + 1
      this.overviewRequestId = requestId
      this.loadingOverview = true
      this.overviewError = ''

      try {
        const [summary, performance] = await Promise.all([
          getTradingAccountSummary({
            refresh: options.refresh,
          }),
          getTradingPerformance({
            refresh: options.refresh,
          }),
        ])

        if (requestId !== this.overviewRequestId) {
          return { success: false, error: 'stale_request' }
        }

        this.currentBrokerAccountId = summary.brokerAccountId || performance.brokerAccountId || null
        this.summary = summary
        this.performance = performance
        this.lastLoadedAt = new Date().toISOString()

        return { success: true }
      }
      catch (error: unknown) {
        const message = extractMessage(error, '加载账户概览失败')
        if (requestId === this.overviewRequestId)
          this.overviewError = message
        return {
          success: false,
          error: message,
        }
      }
      finally {
        if (requestId === this.overviewRequestId)
          this.loadingOverview = false
      }
    },

    async loadDetails(options: {
      refresh?: boolean
    }): Promise<{ success: boolean, error?: string }> {
      const requestId = this.detailsRequestId + 1
      this.detailsRequestId = requestId
      this.loadingDetails = true
      this.detailsError = ''

      try {
        const [positions, orders, trades] = await Promise.all([
          getTradingPositions({
            refresh: options.refresh,
          }),
          getTradingOrders({
            refresh: options.refresh,
          }),
          getTradingTrades({
            refresh: options.refresh,
          }),
        ])

        if (requestId !== this.detailsRequestId) {
          return { success: false, error: 'stale_request' }
        }

        this.currentBrokerAccountId = positions.brokerAccountId || orders.brokerAccountId || trades.brokerAccountId || null
        this.positions = positions
        this.orders = orders
        this.trades = trades
        this.lastLoadedAt = new Date().toISOString()

        return { success: true }
      }
      catch (error: unknown) {
        const message = extractMessage(error, '加载交易明细失败')
        if (requestId === this.detailsRequestId)
          this.detailsError = message
        return {
          success: false,
          error: message,
        }
      }
      finally {
        if (requestId === this.detailsRequestId)
          this.loadingDetails = false
      }
    },

    async loadAll(options: {
      refresh?: boolean
    }): Promise<{ success: boolean, error?: string }> {
      const [overviewResult, detailResult] = await Promise.all([
        this.loadOverview(options),
        this.loadDetails(options),
      ])

      if (overviewResult.success && detailResult.success) {
        return { success: true }
      }

      return {
        success: false,
        error: overviewResult.error || detailResult.error || '加载交易账户数据失败',
      }
    },
  },
})
