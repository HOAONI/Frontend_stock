/** 分析调度中心接口封装，负责概览、健康、任务列表和调度动作请求。 */
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

/** 获取当前视角下的调度概览指标。 */
export async function getSchedulerOverview(scope: SchedulerScope = 'mine'): Promise<SchedulerOverview> {
  const { data } = await client.get('/api/v1/analysis/scheduler/overview', {
    params: { scope },
  })
  return toCamelCase<SchedulerOverview>(data)
}

/** 获取调度系统与执行器的健康状态快照。 */
export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  const { data } = await client.get('/api/v1/analysis/scheduler/health')
  return toCamelCase<SchedulerHealth>(data)
}

/** 获取调度任务列表，并把前端筛选条件转换成后端约定的查询参数。 */
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
    // 明细项再额外跑一遍驼峰转换，避免后端局部字段漏转时污染页面模型。
    items: (result.items || []).map(item => toCamelCase(item)),
  }
}

/** 拉取单条调度任务的完整详情。 */
export async function getSchedulerTaskDetail(taskId: string): Promise<SchedulerTaskDetail> {
  const { data } = await client.get(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}`)
  return toCamelCase<SchedulerTaskDetail>(data)
}

/** 对失败任务执行“原任务重试”。 */
export async function retrySchedulerTask(taskId: string): Promise<SchedulerTaskMutationResult> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/retry`)
  return toCamelCase<SchedulerTaskMutationResult>(data)
}

/** 基于当前任务参数重新创建一轮新任务。 */
export async function rerunSchedulerTask(taskId: string): Promise<SchedulerTaskMutationResult> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/rerun`)
  return toCamelCase<SchedulerTaskMutationResult>(data)
}

/** 取消仍在等待或执行中的调度任务。 */
export async function cancelSchedulerTask(taskId: string): Promise<{ taskId: string, status: string, cancelledAt?: string | null }> {
  const { data } = await client.post(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/cancel`)
  return toCamelCase<{ taskId: string, status: string, cancelledAt?: string | null }>(data)
}

/** 更新任务优先级，接口返回的是刷新后的任务主体。 */
export async function updateSchedulerTaskPriority(taskId: string, priority: number): Promise<SchedulerTaskDetail['task']> {
  const { data } = await client.patch(`/api/v1/analysis/scheduler/tasks/${encodeURIComponent(taskId)}/priority`, {
    priority,
  })
  const result = toCamelCase<{ task: SchedulerTaskDetail['task'] }>(data)
  return result.task
}
