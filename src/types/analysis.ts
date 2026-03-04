export interface AnalysisRequest {
  stockCode: string
  reportType?: 'simple' | 'detailed'
  forceRefresh?: boolean
  executionMode?: 'auto' | 'paper'
}

export interface ReportMeta {
  queryId: string
  stockCode: string
  stockName: string
  reportType: 'simple' | 'detailed'
  createdAt: string
  currentPrice?: number | null
  changePct?: number | null
}

export interface ReportSummary {
  analysisSummary: string
  operationAdvice: string
  trendPrediction: string
  sentimentScore: number
  sentimentLabel?: string
}

export interface ReportStrategy {
  idealBuy?: string | null
  secondaryBuy?: string | null
  stopLoss?: string | null
  takeProfit?: string | null
}

export interface ReportDetails {
  newsContent?: string | null
  rawResult?: Record<string, unknown> | string | null
  contextSnapshot?: Record<string, unknown> | null
}

export interface AnalysisReport {
  meta: ReportMeta
  summary: ReportSummary
  strategy?: ReportStrategy
  details?: ReportDetails
}

export interface AnalysisResult {
  queryId: string
  stockCode: string
  stockName: string
  report: AnalysisReport
  createdAt: string
}

export interface TaskInfo {
  taskId: string
  stockCode: string
  stockName?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string | null
  reportType: string
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  error?: string | null
}

export type TaskQueueSection = 'running' | 'recent'
export type TaskTerminalStatus = 'completed' | 'failed'
export type TaskSeenAtMap = Record<string, number>

export interface TaskListResponse {
  total: number
  pending: number
  processing: number
  tasks: TaskInfo[]
}

export interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: AnalysisResult | null
  error?: string | null
}

export interface HistoryItem {
  queryId: string
  stockCode: string
  stockName?: string | null
  reportType?: string
  sentimentScore?: number | null
  operationAdvice?: string | null
  createdAt: string
}

export interface HistoryListResponse {
  total: number
  page: number
  limit: number
  items: HistoryItem[]
}

export interface NewsIntelItem {
  title: string
  snippet: string
  url: string
}

export interface NewsIntelResponse {
  total: number
  items: NewsIntelItem[]
}
