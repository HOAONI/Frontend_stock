export type AgentStageCode = 'data' | 'signal' | 'risk' | 'execution'

export type AgentStageStatus = 'pending' | 'done' | 'failed'

export interface AgentStageItem {
  code: AgentStageCode
  title: string
  status: AgentStageStatus
  summary: string
  durationMs?: number | null
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
  errorMessage?: string | null
}

export interface AgentStageResult {
  stages: AgentStageItem[]
  warnings: string[]
}
