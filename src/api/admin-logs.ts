import type { AdminLogDetail, AdminLogsListResponse, ListAdminLogsParams } from '@/types/admin-logs'
import client from './client'
import { toCamelCase } from './case'

export async function listAdminLogs(params: ListAdminLogsParams = {}): Promise<AdminLogsListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }

  if (params.keyword)
    query.keyword = params.keyword
  if (params.userId != null)
    query.user_id = params.userId
  if (params.moduleCode)
    query.module_code = params.moduleCode
  if (params.method)
    query.method = params.method
  if (params.statusCode != null)
    query.status_code = params.statusCode
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/admin/logs', { params: query })
  return toCamelCase<AdminLogsListResponse>(data)
}

export async function getAdminLogDetail(id: number): Promise<AdminLogDetail> {
  const { data } = await client.get(`/api/v1/admin/logs/${id}`)
  return toCamelCase<AdminLogDetail>(data)
}
