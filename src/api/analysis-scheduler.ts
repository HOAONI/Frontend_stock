import client from './client'
import { toCamelCase } from './case'
import type {
  AnalysisScheduleDetail,
  AnalysisScheduleItem,
  AnalysisScheduleListResponse,
  CreateAnalysisSchedulePayload,
  UpdateAnalysisSchedulePayload,
} from '@/types/analysis-scheduler'

export async function listAnalysisSchedules(): Promise<AnalysisScheduleListResponse> {
  const { data } = await client.get('/api/v1/analysis/scheduler/schedules')
  const result = toCamelCase<AnalysisScheduleListResponse>(data)
  return {
    total: Number(result.total ?? 0),
    items: (result.items || []).map(item => toCamelCase<AnalysisScheduleItem>(item)),
  }
}

export async function createAnalysisSchedule(payload: CreateAnalysisSchedulePayload): Promise<AnalysisScheduleItem> {
  const { data } = await client.post('/api/v1/analysis/scheduler/schedules', {
    stock_code: payload.stockCode,
    interval_minutes: payload.intervalMinutes,
    execution_mode: payload.executionMode,
  })
  const result = toCamelCase<{ schedule: AnalysisScheduleItem }>(data)
  return toCamelCase<AnalysisScheduleItem>(result.schedule)
}

export async function getAnalysisScheduleDetail(scheduleId: string): Promise<AnalysisScheduleDetail> {
  const { data } = await client.get(`/api/v1/analysis/scheduler/schedules/${encodeURIComponent(scheduleId)}`)
  return toCamelCase<AnalysisScheduleDetail>(data)
}

export async function updateAnalysisSchedule(
  scheduleId: string,
  payload: UpdateAnalysisSchedulePayload,
): Promise<AnalysisScheduleItem> {
  const body: Record<string, unknown> = {}

  if (payload.stockCode != null)
    body.stock_code = payload.stockCode
  if (payload.intervalMinutes != null)
    body.interval_minutes = payload.intervalMinutes
  if (payload.executionMode != null)
    body.execution_mode = payload.executionMode
  if (payload.enabled != null)
    body.enabled = payload.enabled

  const { data } = await client.patch(`/api/v1/analysis/scheduler/schedules/${encodeURIComponent(scheduleId)}`, body)
  const result = toCamelCase<{ schedule: AnalysisScheduleItem }>(data)
  return toCamelCase<AnalysisScheduleItem>(result.schedule)
}

export async function deleteAnalysisSchedule(scheduleId: string): Promise<{ scheduleId: string }> {
  const { data } = await client.delete(`/api/v1/analysis/scheduler/schedules/${encodeURIComponent(scheduleId)}`)
  return toCamelCase<{ scheduleId: string }>(data)
}
