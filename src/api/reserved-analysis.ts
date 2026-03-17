/** 分析预留接口封装，负责读取任务阶段详情和阶段流地址。 */
import client from './client'
import { toCamelCase } from './case'

export interface ReservedTaskStagesResponse {
  taskId: string
  stages: Array<{
    code: 'data' | 'signal' | 'risk' | 'execution'
    status: 'pending' | 'done' | 'failed'
    summary?: string
    durationMs?: number
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    errorMessage?: string
  }>
}

export async function getReservedTaskStages(taskId: string): Promise<ReservedTaskStagesResponse> {
  const { data } = await client.get(`/api/v1/analysis/tasks/${encodeURIComponent(taskId)}/stages`)
  return toCamelCase<ReservedTaskStagesResponse>(data)
}

export function getReservedTaskStageStreamUrl(taskId: string): string {
  return `/api/v1/analysis/tasks/${encodeURIComponent(taskId)}/stages/stream`
}
