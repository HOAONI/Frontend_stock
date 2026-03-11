export type SchedulerScope = 'mine' | 'all'
export type SchedulerTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type SchedulerExecutionMode = 'paper' | 'broker'
export type SchedulerRequestedExecutionMode = 'auto' | 'paper'
export type SchedulerWorkerMode = 'embedded' | 'external'

export interface SchedulerTaskItem {
  taskId: string
  rootTaskId: string
  retryOfTaskId?: string | null
  attemptNo: number
  priority: number
  runAfter?: string | null
  cancelledAt?: string | null
  stockCode: string
  reportType: string
  status: SchedulerTaskStatus
  progress: number
  message?: string | null
  resultQueryId?: string | null
  error?: string | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  ownerUserId?: number | null
  ownerUsername?: string | null
  ownerDisplayName?: string | null
  executionMode: SchedulerExecutionMode
  requestedExecutionMode: SchedulerRequestedExecutionMode
  isStale: boolean
}

export interface SchedulerTaskListResponse {
  page: number
  limit: number
  total: number
  items: SchedulerTaskItem[]
}

export interface SchedulerOverview {
  pendingCount: number
  processingCount: number
  failedCount: number
  queueDepth: number
  successRate24h?: number | null
  completed24h: number
  failed24h: number
  oldestPendingWaitMs: number
  staleProcessingCount: number
  updatedAt: string
}

export interface SchedulerWorkerHeartbeat {
  workerName: string
  workerMode: SchedulerWorkerMode
  lastSeenAt: string
  lastTaskId?: string | null
  lastError?: string | null
}

export interface SchedulerHealth {
  backendReady: boolean
  agentLive: boolean
  agentReady: boolean
  agentLiveError?: string | null
  agentReadyError?: string | null
  workerMode: SchedulerWorkerMode
  workerHealthy: boolean
  workerHeartbeat?: SchedulerWorkerHeartbeat | null
  queueMetrics: SchedulerOverview
  policySnapshot: Record<string, unknown>
  updatedAt: string
}

export interface SchedulerTaskDetail {
  task: SchedulerTaskItem
  requestPayload?: unknown
  resultPayload?: unknown
  bridgeMeta?: unknown
  autoOrder?: unknown
  taskChain: SchedulerTaskItem[]
}

export interface SchedulerTaskMutationResult {
  taskId: string
  rootTaskId: string
  retryOfTaskId?: string | null
  attemptNo: number
  status: SchedulerTaskStatus
  message?: string | null
}
