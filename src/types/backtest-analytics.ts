export interface CurvePoint {
  index: number
  label: string
  strategyReturnPct: number
  benchmarkReturnPct: number
  drawdownPct: number
}

export interface TradeDistribution {
  longCount: number
  cashCount: number
  winCount: number
  lossCount: number
  neutralCount: number
}

export interface StrategyCompareItem {
  evalWindowDays: number
  totalEvaluations: number
  completedCount: number
  directionAccuracyPct: number | null
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
