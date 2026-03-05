export interface TradingQueryParams {
  refresh?: boolean
}

export interface AddTradingFundsRequest {
  amount: number
  note?: string
}

export interface TradingAccountMeta {
  brokerAccountId: number
  brokerCode: string
  providerCode?: string | null
  providerName?: string | null
  orderChannel?: string
  environment: string
  accountUid: string
  accountDisplayName: string | null
  snapshotAt: string
  dataSource: 'cache' | 'upstream' | string
}

export interface TradingSummaryResponse extends TradingAccountMeta {
  summary: Record<string, unknown>
}

export interface TradingPerformancePayload {
  totalAsset?: number | null
  cash?: number | null
  marketValue?: number | null
  pnlDaily?: number | null
  pnlTotal?: number | null
  returnPct?: number | null
  rawSummary?: Record<string, unknown>
}

export interface TradingPerformanceResponse extends TradingAccountMeta {
  performance: TradingPerformancePayload
}

export interface TradingPositionsResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

export interface TradingOrdersResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

export interface TradingTradesResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

export interface TradingFundChangePayload {
  amount: number
  note?: string | null
  cashBefore?: number | null
  cashAfter?: number | null
  initialCapitalBefore?: number | null
  initialCapitalAfter?: number | null
}

export interface TradingAddFundsResponse extends TradingAccountMeta {
  fundChange: TradingFundChangePayload
  summary: Record<string, unknown>
  performance: TradingPerformancePayload
}
