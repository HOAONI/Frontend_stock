export type BacktestStrategyTemplateCode = 'ma_cross' | 'rsi_threshold'

export interface BacktestStrategyTemplateParamSchema {
  key: string
  label: string
  description: string
  min: number
  max: number
  step: number
  defaultValue: number
}

export interface BacktestStrategyTemplate {
  templateCode: BacktestStrategyTemplateCode
  templateName: string
  description: string
  defaultParams: Record<string, number>
  paramSchema: BacktestStrategyTemplateParamSchema[]
}

export interface BacktestStrategyTemplateListResponse {
  items: BacktestStrategyTemplate[]
}

export interface UserBacktestStrategyItem {
  id: number
  name: string
  description: string | null
  templateCode: BacktestStrategyTemplateCode
  templateName: string
  params: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface UserBacktestStrategyListResponse {
  items: UserBacktestStrategyItem[]
}

export interface CreateUserBacktestStrategyRequest {
  name: string
  description?: string
  templateCode: BacktestStrategyTemplateCode
  params: Record<string, number>
}

export interface UpdateUserBacktestStrategyRequest {
  name?: string
  description?: string
  templateCode?: BacktestStrategyTemplateCode
  params?: Record<string, number>
}

export interface StrategyEquityPoint {
  tradeDate: string | null
  equity: number
  drawdownPct: number | null
  benchmarkEquity: number | null
}

export interface StrategyTradeItem {
  entryDate: string | null
  exitDate: string | null
  entryPrice: number | null
  exitPrice: number | null
  qty: number | null
  grossReturnPct: number | null
  netReturnPct: number | null
  fees: number | null
  exitReason: string | null
}

export interface StrategyRunItem {
  runId: number
  strategyId: number | null
  strategyCode: string
  strategyName: string
  templateCode: string
  templateName: string
  strategyVersion: string
  params: Record<string, unknown>
  metrics: Record<string, unknown>
  benchmark: Record<string, unknown>
  trades: StrategyTradeItem[]
  equity: StrategyEquityPoint[]
}

export interface StrategyDateRange {
  startDate: string | null
  endDate: string | null
}

export interface StrategyRangeRunResponse {
  runGroupId: number
  code: string
  engineVersion: string
  requestedRange: StrategyDateRange
  effectiveRange: StrategyDateRange
  createdAt: string
  items: StrategyRunItem[]
  legacyEventBacktest: boolean
}

export interface StrategyRunHistoryItem {
  runGroupId: number
  code: string
  engineVersion: string
  requestedRange: StrategyDateRange
  effectiveRange: StrategyDateRange
  createdAt: string
  strategies: Array<{
    runId: number
    strategyId: number | null
    strategyCode: string
    strategyName: string
    templateCode: string
    templateName: string
    strategyVersion: string
    metrics: Record<string, unknown>
  }>
}

export interface StrategyRunHistoryResponse {
  total: number
  page: number
  limit: number
  items: StrategyRunHistoryItem[]
  legacyEventBacktest: boolean
}

export interface StrategyRangeRunRequest {
  code: string
  startDate: string
  endDate: string
  strategyIds?: number[]
  strategyCodes?: string[]
  initialCapital?: number
  commissionRate?: number
  slippageBps?: number
}
