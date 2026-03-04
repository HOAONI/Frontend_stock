import type {
  AnalysisRequest,
  AnalysisResult,
  HistoryListResponse,
  NewsIntelResponse,
  TaskInfo,
  TaskListResponse,
  TaskStatus,
} from '@/types/analysis'
import client from './client'
import { toCamelCase } from './case'

export class DuplicateTaskError extends Error {
  stockCode: string
  existingTaskId: string

  constructor(stockCode: string, existingTaskId: string, message?: string) {
    super(message || `股票 ${stockCode} 正在分析中`)
    this.name = 'DuplicateTaskError'
    this.stockCode = stockCode
    this.existingTaskId = existingTaskId
  }
}

export async function analyzeAsync(payload: AnalysisRequest): Promise<{ taskId: string, status: string, message?: string }> {
  const executionMode = payload.executionMode || 'auto'
  const body = {
    stock_code: payload.stockCode,
    report_type: payload.reportType || 'detailed',
    force_refresh: payload.forceRefresh ?? false,
    async_mode: true,
    execution_mode: executionMode,
  }

  const response = await client.post('/api/v1/analysis/analyze', body, {
    validateStatus: status => status === 202 || status === 409,
  })

  if (response.status === 409) {
    const err = toCamelCase<{ stockCode: string, existingTaskId: string, message: string }>(response.data)
    throw new DuplicateTaskError(err.stockCode, err.existingTaskId, err.message)
  }

  return toCamelCase<{ taskId: string, status: string, message?: string }>(response.data)
}

export async function getTaskList(status?: string, limit = 50): Promise<TaskListResponse> {
  const { data } = await client.get('/api/v1/analysis/tasks', {
    params: {
      status,
      limit,
    },
  })
  const result = toCamelCase<TaskListResponse>(data)
  return {
    total: result.total,
    pending: result.pending,
    processing: result.processing,
    tasks: (result.tasks || []).map(task => toCamelCase<TaskInfo>(task)),
  }
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const { data } = await client.get(`/api/v1/analysis/status/${taskId}`)
  return toCamelCase<TaskStatus>(data)
}

export function getTaskStreamUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/'
  if (base === '/') {
    return '/api/v1/analysis/tasks/stream'
  }
  return `${base.replace(/\/$/, '')}/api/v1/analysis/tasks/stream`
}

export async function getHistoryList(params: {
  stockCode?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
} = {}): Promise<HistoryListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }

  if (params.stockCode)
    query.stock_code = params.stockCode
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/history', { params: query })
  return toCamelCase<HistoryListResponse>(data)
}

export async function getHistoryDetail(queryId: string): Promise<AnalysisResult['report']> {
  const { data } = await client.get(`/api/v1/history/${queryId}`)
  return toCamelCase<AnalysisResult['report']>(data)
}

export async function getHistoryNews(queryId: string, limit = 20): Promise<NewsIntelResponse> {
  const { data } = await client.get(`/api/v1/history/${queryId}/news`, {
    params: { limit },
  })
  return toCamelCase<NewsIntelResponse>(data)
}
