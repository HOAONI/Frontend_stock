/** Agent 分析阶段相关类型定义，统一描述阶段编码、状态和结果结构。 */
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
