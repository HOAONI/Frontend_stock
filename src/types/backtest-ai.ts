export type BacktestAiInterpretationStatus = 'ready' | 'failed' | 'unavailable'

export interface BacktestAiInterpretation {
  version: 'v1' | string
  status: BacktestAiInterpretationStatus | string
  verdict: string | null
  summary: string
  generatedAt: string | null
  source: string
  provider: string
  model: string
  errorMessage: string | null
}
