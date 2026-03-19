/** 分析中心接口封装，负责提交分析任务、查询队列和读取历史报告。 */
import type {
  AnalysisRequest,
  AnalysisResult,
  HistoryItem,
  HistoryListResponse,
  HistoryStatusFilter,
  NewsIntelResponse,
  TaskInfo,
  TaskListResponse,
  TaskStatus,
} from '@/types/analysis'
import client from './client'
import { toCamelCase } from './case'

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string')
    return null
  const normalized = value.trim()
  return normalized || null
}

function normalizeHistoryStatus(item: Partial<HistoryItem>): HistoryItem['status'] {
  if (item.status === 'completed' || item.status === 'failed')
    return item.status
  return normalizeOptionalText(item.errorMessage) ? 'failed' : 'completed'
}

function normalizeHistoryItem(input: unknown): HistoryItem {
  const item = toCamelCase<Partial<HistoryItem>>(input)
  const queryId = normalizeOptionalText(item.queryId) ?? null
  const taskId = normalizeOptionalText(item.taskId) ?? queryId
  const status = normalizeHistoryStatus(item)

  return {
    queryId,
    taskId,
    stockCode: normalizeOptionalText(item.stockCode) || '',
    stockName: normalizeOptionalText(item.stockName),
    reportType: normalizeOptionalText(item.reportType) ?? undefined,
    sentimentScore: item.sentimentScore ?? null,
    operationAdvice: normalizeOptionalText(item.operationAdvice),
    status,
    errorMessage: status === 'failed'
      ? normalizeOptionalText(item.errorMessage) || '分析失败（无详细错误）'
      : normalizeOptionalText(item.errorMessage),
    createdAt: normalizeOptionalText(item.createdAt) || '',
  }
}

/**
 * 用业务错误显式区分“任务已在运行中”的场景，
 * 页面可以据此给出更友好的提示，而不是统一落入通用报错。
 */
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

/** 异步提交一条分析任务；后端接受后会返回 taskId 供后续轮询或 SSE 跟踪。 */
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

/** 拉取任务队列快照，并统一补齐状态统计字段，避免页面层重复判空。 */
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
    completed: Number(result.completed ?? 0),
    failed: Number(result.failed ?? 0),
    cancelled: Number(result.cancelled ?? 0),
    tasks: (result.tasks || []).map(task => toCamelCase<TaskInfo>(task)),
  }
}

/** 查询单个任务的当前状态，通常用于短轮询兜底。 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const { data } = await client.get(`/api/v1/analysis/status/${taskId}`)
  return toCamelCase<TaskStatus>(data)
}

/** 构造任务流 SSE 地址，兼容不同部署前缀下的 baseURL 配置。 */
export function getTaskStreamUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/'
  if (base === '/') {
    return '/api/v1/analysis/tasks/stream'
  }
  return `${base.replace(/\/$/, '')}/api/v1/analysis/tasks/stream`
}

/** 获取历史报告列表，并统一分页参数约定。 */
export async function getHistoryList(params: {
  stockCode?: string
  startDate?: string
  endDate?: string
  status?: HistoryStatusFilter
  page?: number
  limit?: number
} = {}): Promise<HistoryListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
    status: params.status || 'completed',
  }

  if (params.stockCode)
    query.stock_code = params.stockCode
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/history', { params: query })
  const result = toCamelCase<HistoryListResponse & { items?: unknown[] }>(data)

  return {
    total: Number(result.total ?? 0),
    page: Number(result.page ?? query.page),
    limit: Number(result.limit ?? query.limit),
    items: (result.items || []).map(item => normalizeHistoryItem(item)),
  }
}

/** 根据 queryId 读取一份完整历史报告。 */
export async function getHistoryDetail(queryId: string): Promise<AnalysisResult['report']> {
  const { data } = await client.get(`/api/v1/history/${queryId}`)
  return toCamelCase<AnalysisResult['report']>(data)
}

/** 读取历史报告关联的新闻情报，供详情面板直接展示。 */
export async function getHistoryNews(queryId: string, limit = 20): Promise<NewsIntelResponse> {
  const { data } = await client.get(`/api/v1/history/${queryId}/news`, {
    params: { limit },
  })
  return toCamelCase<NewsIntelResponse>(data)
}
