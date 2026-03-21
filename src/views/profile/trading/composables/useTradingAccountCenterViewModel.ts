import type { DataTableColumns } from 'naive-ui'
import { NTag } from 'naive-ui'
import { computed, h } from 'vue'
import { trendValueStyle } from '@/constants/semantic-ui'
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'
import { formatDateTime, formatPct } from '@/utils/stock'
import type {
  TradingAccountActivityItem,
  TradingAccountDetailTabModel,
  TradingAccountHeroModel,
  TradingAccountKpiModel,
  TradingUiType,
} from '../types'

// 交易明细来自多个上游接口，字段命名并不完全一致，这里统一做别名映射。
const COMMON_FIELD_LABELS: Record<string, string> = {
  stockCode: '代码',
  stock_code: '代码',
  symbol: '代码',
  ticker: '代码',
  code: '代码',
  securityCode: '代码',
  security_code: '代码',
  stockName: '名称',
  stock_name: '名称',
  name: '名称',
  direction: '方向',
  side: '方向',
  action: '动作',
  orderSide: '方向',
  order_side: '方向',
  quantity: '数量',
  qty: '数量',
  volume: '数量',
  filledQuantity: '成交数量',
  filled_quantity: '成交数量',
  filledVolume: '成交数量',
  filled_volume: '成交数量',
  availableQuantity: '可卖数量',
  available_quantity: '可卖数量',
  frozenQuantity: '冻结数量',
  frozen_quantity: '冻结数量',
  price: '价格',
  avgPrice: '均价',
  avg_price: '均价',
  lastPrice: '最新价',
  last_price: '最新价',
  costPrice: '成本价',
  cost_price: '成本价',
  marketValue: '市值',
  market_value: '市值',
  pnlDaily: '当日盈亏',
  pnl_daily: '当日盈亏',
  pnlTotal: '累计盈亏',
  pnl_total: '累计盈亏',
  returnPct: '收益率',
  return_pct: '收益率',
  profitRate: '收益率',
  profit_rate: '收益率',
  status: '状态',
  orderStatus: '状态',
  order_status: '状态',
  tradeStatus: '状态',
  trade_status: '状态',
  providerStatus: '上游状态',
  provider_status: '上游状态',
  orderId: '委托 ID',
  order_id: '委托 ID',
  tradeId: '成交 ID',
  trade_id: '成交 ID',
  id: 'ID',
  submittedAt: '提交时间',
  submitted_at: '提交时间',
  createdAt: '创建时间',
  created_at: '创建时间',
  updatedAt: '更新时间',
  updated_at: '更新时间',
  orderTime: '委托时间',
  order_time: '委托时间',
  tradeTime: '成交时间',
  trade_time: '成交时间',
  executedAt: '成交时间',
  executed_at: '成交时间',
}

const POSITION_PRIORITY = [
  'stockCode',
  'stock_code',
  'symbol',
  'ticker',
  'code',
  'securityCode',
  'security_code',
  'stockName',
  'stock_name',
  'name',
  'quantity',
  'qty',
  'availableQuantity',
  'available_quantity',
  'costPrice',
  'cost_price',
  'lastPrice',
  'last_price',
  'marketValue',
  'market_value',
  'pnlDaily',
  'pnl_daily',
  'pnlTotal',
  'pnl_total',
  'returnPct',
  'return_pct',
  'updatedAt',
  'updated_at',
] as const

const ORDER_PRIORITY = [
  'orderId',
  'order_id',
  'stockCode',
  'stock_code',
  'symbol',
  'ticker',
  'direction',
  'side',
  'action',
  'orderSide',
  'order_side',
  'quantity',
  'qty',
  'filledQuantity',
  'filled_quantity',
  'price',
  'avgPrice',
  'avg_price',
  'status',
  'orderStatus',
  'order_status',
  'providerStatus',
  'provider_status',
  'submittedAt',
  'submitted_at',
  'updatedAt',
  'updated_at',
] as const

const TRADE_PRIORITY = [
  'tradeId',
  'trade_id',
  'orderId',
  'order_id',
  'stockCode',
  'stock_code',
  'symbol',
  'ticker',
  'direction',
  'side',
  'action',
  'quantity',
  'qty',
  'price',
  'avgPrice',
  'avg_price',
  'status',
  'tradeStatus',
  'trade_status',
  'executedAt',
  'executed_at',
  'tradeTime',
  'trade_time',
] as const

function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value))
    return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatText(value: unknown, fallback = '--'): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

function formatEnvironment(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized)
    return '--'
  if (normalized === 'simulation')
    return '模拟环境'
  if (normalized === 'paper')
    return '纸面环境'
  if (normalized === 'production')
    return '实盘环境'
  return formatText(value)
}

function resolveStatusLabel(isBound: boolean | undefined, isVerified: boolean | undefined): string {
  if (!isBound)
    return '未初始化'
  if (!isVerified)
    return '待校验'
  return '已就绪'
}

function resolveStatusType(isBound: boolean | undefined, isVerified: boolean | undefined): TradingUiType {
  if (!isBound || !isVerified)
    return 'warning'
  return 'success'
}

function statusDescription(isBound: boolean | undefined, isVerified: boolean | undefined): string {
  if (!isBound)
    return '当前没有可用的模拟账户，请先完成初始化与校验。'
  if (!isVerified)
    return '账户已绑定但尚未完成校验，当前仅可维护参数，暂不可入金或拉取交易快照。'
  return '账户已通过校验，可以查看资产快照、近期活动和完整交易明细。'
}

function directionTagType(direction: string): TradingUiType {
  const value = direction.toLowerCase()
  if (value.includes('买') || value.includes('buy'))
    return 'success'
  if (value.includes('卖') || value.includes('sell'))
    return 'warning'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}

function statusTagType(status: string): TradingUiType {
  const value = status.toLowerCase()
  if (value.includes('成') || value.includes('filled') || value.includes('success'))
    return 'success'
  if (value.includes('待') || value.includes('提交') || value.includes('pending'))
    return 'warning'
  if (value.includes('拒') || value.includes('fail') || value.includes('error'))
    return 'error'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}

function isTimeKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return normalized.endsWith('time') || normalized.endsWith('date') || normalized.endsWith('at') || normalized.endsWith('_at')
}

function isPercentKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return normalized.endsWith('pct') || normalized.endsWith('rate') || normalized.endsWith('ratio')
}

function isMoneyKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return ['cash', 'asset', 'equity', 'value', 'price', 'pnl', 'capital', 'cost', 'amount'].some(token => normalized.includes(token))
}

function prettifyFieldLabel(key: string): string {
  if (COMMON_FIELD_LABELS[key])
    return COMMON_FIELD_LABELS[key]

  const normalized = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  if (!normalized)
    return key
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatCellValue(key: string, value: unknown): string {
  if (value == null)
    return '--'
  if (isTimeKey(key))
    return formatDateTime(String(value))

  if (typeof value === 'number') {
    if (isPercentKey(key))
      return formatPct(value)
    if (isMoneyKey(key))
      return formatAmount(value)
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }

  if (typeof value === 'object')
    return JSON.stringify(value)

  if (isPercentKey(key)) {
    const numberValue = Number(value)
    if (Number.isFinite(numberValue))
      return formatPct(numberValue)
  }

  return String(value)
}

function collectOrderedKeys(items: Array<Record<string, unknown>>): string[] {
  const orderedKeys: string[] = []
  const seen = new Set<string>()
  items.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (seen.has(key))
        return
      seen.add(key)
      orderedKeys.push(key)
    })
  })
  return orderedKeys
}

function buildPrioritizedColumns(
  items: Array<Record<string, unknown>>,
  priorities: readonly string[],
  maxColumns = 12,
): DataTableColumns<Record<string, unknown>> {
  if (!items.length)
    return []

  const discoveredKeys = collectOrderedKeys(items)
  const presentKeys = new Set(discoveredKeys)
  const prioritizedKeys = priorities.filter(key => presentKeys.has(key))
  const remainingKeys = discoveredKeys.filter(key => !prioritizedKeys.includes(key))
  const orderedKeys = [...prioritizedKeys, ...remainingKeys].slice(0, maxColumns)

  // 表格列顺序优先保证“可读字段”靠前，尾部的原始兼容字段只在有空间时展示。
  return orderedKeys.map((key) => {
    const fieldLabel = prettifyFieldLabel(key)
    return {
      title: fieldLabel,
      key,
      minWidth: isTimeKey(key) ? 180 : 120,
      ellipsis: { tooltip: true },
      render: (row: Record<string, unknown>) => {
        const value = row[key]

        if (key === 'direction' || key === 'side' || key === 'action' || key === 'orderSide' || key === 'order_side') {
          return h(
            NTag,
            { size: 'small', type: directionTagType(formatText(value)) },
            { default: () => formatText(value) },
          )
        }

        if (key === 'status' || key === 'orderStatus' || key === 'order_status' || key === 'tradeStatus' || key === 'trade_status' || key === 'providerStatus' || key === 'provider_status') {
          return h(
            NTag,
            { size: 'small', type: statusTagType(formatText(value)) },
            { default: () => formatText(value) },
          )
        }

        return formatCellValue(key, value)
      },
    }
  })
}

/**
 * 把原始交易账户快照整理为页面卡片、标签和表格模型。
 * 页面层只负责布局，字段兼容与展示优先级都集中在这里处理。
 */
export function useTradingAccountCenterViewModel() {
  const brokerAccountStore = useBrokerAccountStore()
  const tradingAccountStore = useTradingAccountStore()

  const simulationStatus = computed(() => brokerAccountStore.simulationStatus)
  const canLoadTradingData = computed(() => Boolean(simulationStatus.value?.isBound && simulationStatus.value?.isVerified))
  const accountStateLabel = computed(() => resolveStatusLabel(simulationStatus.value?.isBound, simulationStatus.value?.isVerified))
  const accountStateType = computed(() => resolveStatusType(simulationStatus.value?.isBound, simulationStatus.value?.isVerified))
  const stateDescription = computed(() => statusDescription(simulationStatus.value?.isBound, simulationStatus.value?.isVerified))

  const homeSnapshot = computed(() => tradingAccountStore.homeSnapshot)
  const homeKpis = computed(() => tradingAccountStore.homeKpis)

  const heroCard = computed<TradingAccountHeroModel>(() => {
    const accountLabel = simulationStatus.value?.accountDisplayName
      || simulationStatus.value?.accountUid
      || (homeSnapshot.value.accountLabel !== '--' ? homeSnapshot.value.accountLabel : '')
      || '未初始化模拟账户'

    return {
      title: accountLabel,
      accountUid: formatText(simulationStatus.value?.accountUid),
      description: stateDescription.value,
      statusLabel: accountStateLabel.value,
      statusType: accountStateType.value,
      providerLabel: formatText(simulationStatus.value?.providerName || homeSnapshot.value.providerLabel),
      environmentLabel: formatEnvironment(simulationStatus.value?.environment),
      dataSourceLabel: formatText(homeSnapshot.value.dataSource),
      lastVerifiedAt: formatDateTime(simulationStatus.value?.lastVerifiedAt),
      lastSyncedAt: formatDateTime(tradingAccountStore.lastLoadedAt || homeSnapshot.value.snapshotAt),
    }
  })

  const kpiCards = computed<TradingAccountKpiModel[]>(() => {
    return [
      {
        key: 'total-asset',
        label: '总资产',
        value: homeKpis.value.totalAsset,
        precision: 2,
        caption: canLoadTradingData.value ? '账户权益总览' : '初始化后显示',
      },
      {
        key: 'cash',
        label: '可用现金',
        value: homeKpis.value.cash,
        precision: 2,
        caption: canLoadTradingData.value ? '当前可用资金' : '校验后显示',
      },
      {
        key: 'pnl-daily',
        label: '当日盈亏',
        value: homeKpis.value.pnlDaily,
        precision: 2,
        valueStyle: trendValueStyle(homeKpis.value.pnlDaily),
        caption: canLoadTradingData.value ? '今日表现' : '快照未就绪',
      },
      {
        key: 'return-pct',
        label: '收益率',
        value: homeKpis.value.returnPct,
        precision: 2,
        suffix: '%',
        valueStyle: trendValueStyle(homeKpis.value.returnPct),
        caption: canLoadTradingData.value ? '累计收益率' : '快照未就绪',
      },
    ]
  })

  const fundingReference = computed(() => {
    return {
      cashText: formatAmount(homeKpis.value.cash),
      totalAssetText: formatAmount(homeKpis.value.totalAsset),
    }
  })

  const recentOrders = computed<TradingAccountActivityItem[]>(() => tradingAccountStore.homeRecentOrders)
  const recentTrades = computed<TradingAccountActivityItem[]>(() => tradingAccountStore.homeRecentTrades)

  const activityColumns = computed<DataTableColumns<TradingAccountActivityItem>>(() => {
    return [
      {
        title: '标的',
        key: 'stockCode',
        minWidth: 110,
        ellipsis: { tooltip: true },
      },
      {
        title: '方向',
        key: 'direction',
        width: 96,
        render: row => h(
          NTag,
          { size: 'small', type: directionTagType(row.direction) },
          { default: () => row.direction },
        ),
      },
      {
        title: '数量',
        key: 'quantity',
        minWidth: 100,
      },
      {
        title: '状态',
        key: 'status',
        minWidth: 108,
        render: row => h(
          NTag,
          { size: 'small', type: statusTagType(row.status) },
          { default: () => row.status },
        ),
      },
      {
        title: '时间',
        key: 'time',
        minWidth: 168,
        ellipsis: { tooltip: true },
      },
    ]
  })

  const detailTabs = computed<TradingAccountDetailTabModel[]>(() => {
    return [
      {
        name: 'positions',
        label: '持仓',
        count: tradingAccountStore.positions?.total || 0,
        emptyDescription: '暂无持仓数据',
        columns: buildPrioritizedColumns(tradingAccountStore.positions?.items || [], POSITION_PRIORITY),
        data: tradingAccountStore.positions?.items || [],
      },
      {
        name: 'orders',
        label: '委托',
        count: tradingAccountStore.orders?.total || 0,
        emptyDescription: '暂无委托数据',
        columns: buildPrioritizedColumns(tradingAccountStore.orders?.items || [], ORDER_PRIORITY),
        data: tradingAccountStore.orders?.items || [],
      },
      {
        name: 'trades',
        label: '成交',
        count: tradingAccountStore.trades?.total || 0,
        emptyDescription: '暂无成交数据',
        columns: buildPrioritizedColumns(tradingAccountStore.trades?.items || [], TRADE_PRIORITY),
        data: tradingAccountStore.trades?.items || [],
      },
    ]
  })

  return {
    simulationStatus,
    canLoadTradingData,
    accountStateLabel,
    accountStateType,
    heroCard,
    kpiCards,
    fundingReference,
    recentOrders,
    recentTrades,
    activityColumns,
    detailTabs,
  }
}
