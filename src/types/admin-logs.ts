export interface AdminLogItem {
  id: number
  requestId?: string | null
  userId?: number | null
  username: string
  displayName?: string | null
  method: string
  path: string
  moduleCode: string
  action: string
  statusCode: number
  success: boolean
  durationMs: number
  errorCode?: string | null
  eventType: string
  eventSummary: string
  moduleLabel: string
  resultLabel: '成功' | '失败'
  targetLabel?: string | null
  createdAt: string
}

export interface AdminLogDetail extends AdminLogItem {
  ip?: string | null
  userAgent?: string | null
  queryMasked: unknown
  bodyMasked: unknown
  responseMasked: unknown
}

export interface ListAdminLogsParams {
  keyword?: string
  userId?: number
  moduleCode?: string
  method?: string
  statusCode?: number
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface AdminLogsListResponse {
  total: number
  page: number
  limit: number
  items: AdminLogItem[]
}
