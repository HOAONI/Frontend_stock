export interface AgentBacktestDateRange {
  startDate: string | null
  endDate: string | null
}

export interface AgentBacktestRuntimeStrategy {
  positionMaxPct?: number
  stopLossPct?: number
  takeProfitPct?: number
}

export interface AgentBacktestRunRequest {
  code: string
  startDate: string
  endDate: string
  initialCapital?: number
  commissionRate?: number
  slippageBps?: number
  runtimeStrategy?: AgentBacktestRuntimeStrategy
  enableRefine?: boolean
}

export interface AgentBacktestEquityPoint {
  tradeDate: string | null
  equity: number
  drawdownPct: number | null
  benchmarkEquity: number | null
  positionRatio: number | null
  cash: number | null
}

export interface AgentBacktestTradeItem {
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

export interface AgentBacktestDailyStep {
  tradeDate: string | null
  decisionSource: string
  aiUsed: boolean
  dataPayload: Record<string, unknown>
  signalPayload: Record<string, unknown>
  riskPayload: Record<string, unknown>
  executionPayload: Record<string, unknown>
}

export interface AgentBacktestLlmMeta {
  source: 'system' | 'personal' | string
  provider: string
  baseUrl: string
  model: string
}

export interface AgentBacktestDetailResponse {
  runGroupId: number
  code: string
  engineVersion: string
  requestedRange: AgentBacktestDateRange
  effectiveRange: AgentBacktestDateRange
  status: 'refining' | 'completed' | 'failed' | string
  phase: 'fast' | 'refine' | 'done' | string
  progressPct: number
  message: string | null
  createdAt: string | null
  completedAt: string | null
  activeResultVersion: number
  llmMeta?: AgentBacktestLlmMeta | null
  summary: Record<string, unknown>
  diagnostics: Record<string, unknown>
  decisionSourceBreakdown: Record<string, number>
  dailySteps: AgentBacktestDailyStep[]
  trades: AgentBacktestTradeItem[]
  equity: AgentBacktestEquityPoint[]
  legacyEventBacktest: boolean
}

export interface AgentBacktestHistoryItem {
  runGroupId: number
  code: string
  requestedRange: AgentBacktestDateRange
  effectiveRange: AgentBacktestDateRange
  status: 'refining' | 'completed' | 'failed' | string
  phase: 'fast' | 'refine' | 'done' | string
  createdAt: string | null
  completedAt: string | null
  llmMeta?: AgentBacktestLlmMeta | null
  summary: Record<string, unknown>
}

export interface AgentBacktestHistoryResponse {
  total: number
  page: number
  limit: number
  items: AgentBacktestHistoryItem[]
  legacyEventBacktest: boolean
}
