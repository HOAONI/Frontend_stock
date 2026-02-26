export interface BacktestRunRequest {
  code?: string
  force?: boolean
  evalWindowDays?: number
  minAgeDays?: number
  limit?: number
}

export interface BacktestRunResponse {
  processed: number
  saved: number
  completed: number
  insufficient: number
  errors: number
}

export interface BacktestResultItem {
  analysisHistoryId: number
  code: string
  analysisDate?: string | null
  evalWindowDays: number
  engineVersion: string
  evalStatus: string
  evaluatedAt: string
  operationAdvice?: string | null
  positionRecommendation?: string | null
  startPrice?: number | null
  endClose?: number | null
  maxHigh?: number | null
  minLow?: number | null
  stockReturnPct?: number | null
  directionExpected?: string | null
  directionCorrect?: boolean | null
  outcome?: string | null
  stopLoss?: number | null
  takeProfit?: number | null
  hitStopLoss?: boolean | null
  hitTakeProfit?: boolean | null
  firstHit?: string | null
  firstHitDate?: string | null
  firstHitTradingDays?: number | null
  simulatedEntryPrice?: number | null
  simulatedExitPrice?: number | null
  simulatedExitReason?: string | null
  simulatedReturnPct?: number | null
}

export interface BacktestResultsResponse {
  total: number
  page: number
  limit: number
  items: BacktestResultItem[]
}

export interface PerformanceMetrics {
  scope: string
  code?: string | null
  evalWindowDays: number
  engineVersion: string
  computedAt: string
  totalEvaluations: number
  completedCount: number
  insufficientCount: number
  longCount: number
  cashCount: number
  winCount: number
  lossCount: number
  neutralCount: number
  directionAccuracyPct?: number | null
  winRatePct?: number | null
  neutralRatePct?: number | null
  avgStockReturnPct?: number | null
  avgSimulatedReturnPct?: number | null
  stopLossTriggerRate?: number | null
  takeProfitTriggerRate?: number | null
  ambiguousRate?: number | null
  avgDaysToFirstHit?: number | null
  adviceBreakdown: Record<string, unknown>
  diagnostics: Record<string, unknown>
}
