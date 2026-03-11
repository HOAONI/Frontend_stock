import client from './client'
import { toCamelCase } from './case'
import type {
  SchedulerHealth,
  SchedulerOverview,
  SchedulerScope,
  SchedulerTaskDetail,
  SchedulerTaskListResponse,
  SchedulerTaskMutationResult,
} from '@/types/analysis-scheduler'

export async function getSchedulerOverview(scope: SchedulerScope = 'mine'): Promise<SchedulerOverview> {
  const { data } = await client.get('/api/v1/analysis/scheduler/overview', {
    params: { scope },
  })
  return toCamelCase<SchedulerOverview>(data)
}

export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  const { data } = await client.get('/api/v1/analysis/scheduler/health')
  return toCamelCase<SchedulerHealth>(data)
}

export async function listSchedulerTasks(params: {
  page?: number
  limit?: number
  status?: string
  stockCode?: string
  username?: string
  executionMode?: string
  staleOnly?: boolean
  startDate?: string
  endDate?: string
  scope?: SchedulerScope
} = {}): Promise<SchedulerTaskListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
    scope: params.scope || 'mine',
  }

  if (params.status)
    query.status = params.status
  if (params.stockCode)
    query.stock_code = params.stockCode
  if (params.username)
    query.username = params.username
  if (params.executionMode)
    query.execution_mode = params.executionMode
  if (params.staleOnly)
    query.stale_only = true
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/analysis/scheduler/tasks', { params: query })
  const result = toCamelCase<SchedulerTaskListResponse>(data)
  return {
    ...result,
    items: (result.items || []).map(item => toCamelCase(item)),
  }
}

export async function getSchedulerTaskDetail(taskId: string): Promise<SchedulerTaskDetail> {
  const { data } = await client.get(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}`)
  return toCamelCase<SchedulerTaskDetail>(data)
}

export async function retrySchedulerTask(taskId: string): Promise<SchedulerTaskMutationResult> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/retry`)
  return toCamelCase<SchedulerTaskMutationResult>(data)
}

export async function rerunSchedulerTask(taskId: string): Promise<SchedulerTaskMutationResult> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/rerun`)
  return toCamelCase<SchedulerTaskMutationResult>(data)
}

export async function cancelSchedulerTask(taskId: string): Promise<{ taskId: string, status: string, cancelledAt?: string | null }> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/cancel`)
  return toCamelCase<{ taskId: string, status: string, cancelledAt?: string | null }>(data)
}

export async function updateSchedulerTaskPriority(taskId: string, priority: number): Promise<SchedulerTaskDetail['task']> {
  const { data } = await client.patch(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/priority`, {
    priority,
  })
  const result = toCamelCase<{ task: SchedulerTaskDetail['task'] }>(data)
  return result.task
}
