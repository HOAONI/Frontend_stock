export const STRATEGY_RANGE_CODES = ['ma20_trend', 'rsi14_mean_reversion'] as const

export type StrategyRangeCode = (typeof STRATEGY_RANGE_CODES)[number]

export const STRATEGY_RANGE_NAME_MAP: Record<StrategyRangeCode, string> = {
  ma20_trend: 'MA20 Trend',
  rsi14_mean_reversion: 'RSI14 Mean Reversion',
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
  strategyCode: StrategyRangeCode
  strategyName: string
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
    strategyCode: StrategyRangeCode
    strategyName: string
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
  strategyCodes?: StrategyRangeCode[]
  initialCapital?: number
  commissionRate?: number
  slippageBps?: number
}
