export type AnalysisScheduleExecutionMode = 'auto' | 'paper'
export type AnalysisScheduleLastTaskStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'skipped'
export type AnalysisScheduleRunStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type AnalysisScheduleRunExecutionMode = 'paper' | 'broker'

export interface AnalysisScheduleItem {
  scheduleId: string
  stockCode: string
  reportType: string
  executionMode: AnalysisScheduleExecutionMode
  intervalMinutes: number
  enabled: boolean
  nextRunAt: string
  lastTriggeredAt?: string | null
  lastTaskId?: string | null
  lastTaskStatus: AnalysisScheduleLastTaskStatus
  lastTaskMessage?: string | null
  lastCompletedAt?: string | null
  lastSkippedAt?: string | null
  lastSkippedReason?: string | null
  pausedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AnalysisScheduleListResponse {
  total: number
  items: AnalysisScheduleItem[]
}

export interface AnalysisScheduleRunItem {
  taskId: string
  scheduleId?: string | null
  rootTaskId: string
  retryOfTaskId?: string | null
  attemptNo: number
  priority: number
  stockCode: string
  reportType: string
  status: AnalysisScheduleRunStatus
  progress: number
  message?: string | null
  error?: string | null
  resultQueryId?: string | null
  executionMode: AnalysisScheduleRunExecutionMode
  requestedExecutionMode: AnalysisScheduleExecutionMode
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
}

export interface AnalysisScheduleDetail {
  schedule: AnalysisScheduleItem
  recentRuns: AnalysisScheduleRunItem[]
}

export interface CreateAnalysisSchedulePayload {
  stockCode: string
  intervalMinutes: number
  executionMode: AnalysisScheduleExecutionMode
}

export interface UpdateAnalysisSchedulePayload {
  stockCode?: string
  intervalMinutes?: number
  executionMode?: AnalysisScheduleExecutionMode
  enabled?: boolean
}

export interface AnalysisScheduleFormModel {
  stockCode: string
  intervalMinutes: number | null
  executionMode: AnalysisScheduleExecutionMode
}
