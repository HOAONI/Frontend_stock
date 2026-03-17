/** 交易账户相关类型定义，描述资产、持仓、委托、成交和入金结果。 */
/** 交易账户查询参数，主要用于控制是否强制刷新上游快照。 */
export interface TradingQueryParams {
  refresh?: boolean
}

/** 入金操作提交给后端的参数。 */
export interface AddTradingFundsRequest {
  amount: number
  note?: string
}

/** 所有交易账户接口共享的元信息。 */
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

/** 账户摘要接口返回值。 */
export interface TradingSummaryResponse extends TradingAccountMeta {
  summary: Record<string, unknown>
}

/** 收益表现区块使用的标准化结构。 */
export interface TradingPerformancePayload {
  totalAsset?: number | null
  cash?: number | null
  marketValue?: number | null
  pnlDaily?: number | null
  pnlTotal?: number | null
  returnPct?: number | null
  rawSummary?: Record<string, unknown>
}

/** 收益表现接口返回值。 */
export interface TradingPerformanceResponse extends TradingAccountMeta {
  performance: TradingPerformancePayload
}

/** 持仓列表接口返回值。 */
export interface TradingPositionsResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

/** 委托列表接口返回值。 */
export interface TradingOrdersResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

/** 成交列表接口返回值。 */
export interface TradingTradesResponse extends TradingAccountMeta {
  total: number
  items: Array<Record<string, unknown>>
}

/** 入金动作的资金变化快照。 */
export interface TradingFundChangePayload {
  amount: number
  note?: string | null
  cashBefore?: number | null
  cashAfter?: number | null
  initialCapitalBefore?: number | null
  initialCapitalAfter?: number | null
}

/** 入金接口返回值，会携带更新后的摘要和表现数据。 */
export interface TradingAddFundsResponse extends TradingAccountMeta {
  fundChange: TradingFundChangePayload
  summary: Record<string, unknown>
  performance: TradingPerformancePayload
}
