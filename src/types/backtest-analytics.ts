export interface CurvePoint {
  index: number
  label: string
  strategyReturnPct: number
  benchmarkReturnPct: number
  drawdownPct: number
}

export interface TradeDistribution {
  positionDistribution: {
    longCount: number
    cashCount: number
  }
  outcomeDistribution: {
    winCount: number
    lossCount: number
    neutralCount: number
  }
}

export const STRATEGY_COMPARE_CODES = ['agent_v1', 'ma20_trend', 'rsi14_mean_reversion'] as const

export type StrategyCompareCode = (typeof STRATEGY_COMPARE_CODES)[number]

export const STRATEGY_COMPARE_NAME_MAP: Record<StrategyCompareCode, string> = {
  agent_v1: 'Agent v1',
  ma20_trend: 'MA20 Trend',
  rsi14_mean_reversion: 'RSI14 Mean Reversion',
}

export const DEFAULT_STRATEGY_COMPARE_CODES: StrategyCompareCode[] = [...STRATEGY_COMPARE_CODES]

export interface StrategyCompareItem {
  strategyCode: StrategyCompareCode
  strategyName: string
  evalWindowDays: number
  totalEvaluations: number
  completedCount: number
  directionAccuracyPct: number | null
  predictionWinRatePct: number | null
  tradeWinRatePct: number | null
  winRatePct: number | null
  avgSimulatedReturnPct: number | null
  avgStockReturnPct: number | null
  maxDrawdownPct: number | null
  dataSource: 'api' | 'mock' | 'derived'
}

export interface BacktestAnalyticsBundle {
  curves: CurvePoint[]
  distribution: TradeDistribution
  maxDrawdownPct: number | null
}
