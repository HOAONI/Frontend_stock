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
      brokerAccountId: number | null
      refresh?: boolean
    }): Promise<{ success: boolean, error?: string }> {
      if (!options.brokerAccountId) {
        this.clearData()
        return {
          success: false,
          error: '请先选择可用的券商账户',
        }
      }

      const requestId = this.overviewRequestId + 1
      this.overviewRequestId = requestId
      this.loadingOverview = true
      this.overviewError = ''

      try {
        const [summary, performance] = await Promise.all([
          getTradingAccountSummary({
            brokerAccountId: options.brokerAccountId,
            refresh: options.refresh,
          }),
          getTradingPerformance({
            brokerAccountId: options.brokerAccountId,
            refresh: options.refresh,
          }),
        ])

        if (requestId !== this.overviewRequestId) {
          return { success: false, error: 'stale_request' }
        }

        this.currentBrokerAccountId = options.brokerAccountId
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
      brokerAccountId: number | null
      refresh?: boolean
    }): Promise<{ success: boolean, error?: string }> {
      if (!options.brokerAccountId) {
        this.positions = null
        this.orders = null
        this.trades = null
        return {
          success: false,
          error: '请先选择可用的券商账户',
        }
      }

      const requestId = this.detailsRequestId + 1
      this.detailsRequestId = requestId
      this.loadingDetails = true
      this.detailsError = ''

      try {
        const [positions, orders, trades] = await Promise.all([
          getTradingPositions({
            brokerAccountId: options.brokerAccountId,
            refresh: options.refresh,
          }),
          getTradingOrders({
            brokerAccountId: options.brokerAccountId,
            refresh: options.refresh,
          }),
          getTradingTrades({
            brokerAccountId: options.brokerAccountId,
            refresh: options.refresh,
          }),
        ])

        if (requestId !== this.detailsRequestId) {
          return { success: false, error: 'stale_request' }
        }

        this.currentBrokerAccountId = options.brokerAccountId
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
      brokerAccountId: number | null
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
