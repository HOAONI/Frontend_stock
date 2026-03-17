/** 调度中心原始接口类型定义，描述任务、概览和健康状态结构。 */
/** 调度中心视角：只看我的任务，或查看全局。 */
export type SchedulerScope = 'mine' | 'all'
/** 调度任务的生命周期状态。 */
export type SchedulerTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
/** 后端最终采用的执行模式。 */
export type SchedulerExecutionMode = 'paper' | 'broker'
/** 页面提交任务时请求的执行模式。 */
export type SchedulerRequestedExecutionMode = 'auto' | 'paper'
/** 执行器的运行模式。 */
export type SchedulerWorkerMode = 'embedded' | 'external'

/** 调度列表里的单条任务。 */
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

/** 调度任务列表分页结果。 */
export interface SchedulerTaskListResponse {
  page: number
  limit: number
  total: number
  items: SchedulerTaskItem[]
}

/** 调度概览面板使用的核心统计数据。 */
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

/** 执行器心跳快照，用于判断后台处理进程是否存活。 */
export interface SchedulerWorkerHeartbeat {
  workerName: string
  workerMode: SchedulerWorkerMode
  lastSeenAt: string
  lastTaskId?: string | null
  lastError?: string | null
}

/** 调度健康接口返回值。 */
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

/** 单任务详情结构，包含任务本体、链路和上下文。 */
export interface SchedulerTaskDetail {
  task: SchedulerTaskItem
  requestPayload?: unknown
  resultPayload?: unknown
  bridgeMeta?: unknown
  autoOrder?: unknown
  taskChain: SchedulerTaskItem[]
}

/** 任务重试、重跑、取消等动作的返回结果。 */
export interface SchedulerTaskMutationResult {
  taskId: string
  rootTaskId: string
  retryOfTaskId?: string | null
  attemptNo: number
  status: SchedulerTaskStatus
  message?: string | null
}
