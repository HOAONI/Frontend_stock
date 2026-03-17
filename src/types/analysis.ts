/** 分析中心相关类型定义，描述任务队列、报告和历史记录结构。 */
/** 提交分析任务时使用的请求参数。 */
export interface AnalysisRequest {
  stockCode: string
  reportType?: 'simple' | 'detailed'
  forceRefresh?: boolean
  executionMode?: 'auto' | 'paper'
}

/** 报告头信息，描述这份报告对应的股票、查询编号和生成时间。 */
export interface ReportMeta {
  queryId: string
  stockCode: string
  stockName: string
  reportType: 'simple' | 'detailed'
  createdAt: string
  currentPrice?: number | null
  changePct?: number | null
}

/** 报告摘要区，面向页面首屏展示最重要的结论。 */
export interface ReportSummary {
  analysisSummary: string
  operationAdvice: string
  trendPrediction: string
  sentimentScore: number
  sentimentLabel?: string
}

/** 报告中的策略建议字段。 */
export interface ReportStrategy {
  idealBuy?: string | null
  secondaryBuy?: string | null
  stopLoss?: string | null
  takeProfit?: string | null
}

/** 报告详情区携带的补充上下文与原始输出。 */
export interface ReportDetails {
  newsContent?: string | null
  rawResult?: Record<string, unknown> | string | null
  contextSnapshot?: Record<string, unknown> | null
}

/** 前端统一消费的一份完整分析报告。 */
export interface AnalysisReport {
  meta: ReportMeta
  summary: ReportSummary
  strategy?: ReportStrategy
  details?: ReportDetails
}

/** 历史接口返回的分析结果包装结构。 */
export interface AnalysisResult {
  queryId: string
  stockCode: string
  stockName: string
  report: AnalysisReport
  createdAt: string
}

/** 任务队列中的单条任务结构。 */
export interface TaskInfo {
  taskId: string
  stockCode: string
  stockName?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  message?: string | null
  reportType: string
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  error?: string | null
}

/** 任务队列区块类型：运行中或最近结束。 */
export type TaskQueueSection = 'running' | 'recent'
/** 任务终态状态集合。 */
export type TaskTerminalStatus = 'completed' | 'failed' | 'cancelled'
/** 记录任务最近被事件流看到的时间，用于快照和 SSE 收敛。 */
export type TaskSeenAtMap = Record<string, number>

/** 任务列表接口返回值。 */
export interface TaskListResponse {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  cancelled: number
  tasks: TaskInfo[]
}

/** 单任务状态轮询返回值。 */
export interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  result?: AnalysisResult | null
  error?: string | null
}

/** 历史报告列表中的单项摘要。 */
export interface HistoryItem {
  queryId: string
  stockCode: string
  stockName?: string | null
  reportType?: string
  sentimentScore?: number | null
  operationAdvice?: string | null
  createdAt: string
}

/** 历史报告列表分页结构。 */
export interface HistoryListResponse {
  total: number
  page: number
  limit: number
  items: HistoryItem[]
}

/** 单条新闻情报结构。 */
export interface NewsIntelItem {
  title: string
  snippet: string
  url: string
}

/** 新闻情报列表返回值。 */
export interface NewsIntelResponse {
  total: number
  items: NewsIntelItem[]
}
