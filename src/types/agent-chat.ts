export type AgentChatEventType =
  | 'thinking'
  | 'tool_start'
  | 'tool_done'
  | 'supervisor_plan'
  | 'stage_update'
  | 'warning'
  | 'message_start'
  | 'message_delta'
  | 'done'
  | 'error'

export interface AgentChatRequest {
  message: string
  sessionId?: string
  context?: Record<string, unknown>
}

export interface AgentChatExecutionSessionGuard {
  timezone?: string | null
  sessions?: string[] | null
  evaluatedAt?: string | null
  nextOpenAt?: string | null
}

export interface AgentChatExecutionResult extends Record<string, unknown> {
  mode?: string
  status?: string
  reason?: string
  message?: string
  executedCount?: number
  candidateOrderCount?: number
  sessionGuard?: AgentChatExecutionSessionGuard | null
}

export interface AgentChatDoneResponse {
  sessionId: string
  content: string
  structuredResult?: Record<string, unknown> | null
  candidateOrders: Array<Record<string, unknown>>
  executionResult?: AgentChatExecutionResult | null
  status: 'analysis_only' | 'simulation_order_submitted' | 'simulation_order_filled' | 'blocked' | string
}

export interface AgentChatMessage {
  id: number
  sessionId: string
  role: 'user' | 'assistant' | string
  content: string
  meta?: AgentChatDoneResponse | Record<string, unknown> | null
  createdAt?: string | null
}

export interface AgentChatSessionItem {
  sessionId: string
  title?: string | null
  latestMessagePreview?: string | null
  messageCount: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface AgentChatSessionDetail extends AgentChatSessionItem {
  context?: Record<string, unknown> | null
  messages: AgentChatMessage[]
}

export interface AgentChatStreamEvent<T = Record<string, unknown>> {
  event: AgentChatEventType
  data: T
}
