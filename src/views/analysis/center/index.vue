<script setup lang="ts">
import { analyzeAsync, DuplicateTaskError, getHistoryDetail, getHistoryList, getHistoryNews, getTaskList, getTaskStatus } from '@/api/analysis'
import { useTaskQueueState } from '@/composables/useTaskQueueState'
import { useTaskStream } from '@/composables/useTaskStream'
import { CARD_DENSITY, DASHBOARD_LAYOUT, GRID_GAP, SPACING } from '@/constants/design-tokens'
import { resolveAgentStages } from '@/services/analysis-service'
import { useBrokerAccountStore } from '@/store'
import type { AnalysisReport, HistoryItem, HistoryStatusFilter, NewsIntelItem, TaskInfo, TaskListResponse } from '@/types/analysis'
import type { AgentStageItem } from '@/types/agent-stages'
import { formatDateTime, validateStockCode } from '@/utils/stock'
import { useThemeVars } from 'naive-ui'
import type { CSSProperties } from 'vue'

// 分析中心同时承载任务提交、流式队列、历史报告和阶段详情，所以状态会拆得比较细。
const brokerAccountStore = useBrokerAccountStore()
const themeVars = useThemeVars()
const router = useRouter()

// 提交区状态。
const stockCode = ref('')
const inputError = ref('')
const duplicateError = ref('')
const executionError = ref('')
const submitting = ref(false)
const executionMode = ref<'auto' | 'paper'>('auto')
const detailTab = ref<'summary' | 'strategy' | 'stages' | 'news'>('summary')

const executionModeOptions = [
  { label: 'Auto（自动下单）', value: 'auto' },
  { label: 'Paper（仅分析）', value: 'paper' },
]

const historyItems = ref<HistoryItem[]>([])
const historyListTotal = ref(0)
const historyPage = ref(1)
const historyLimit = ref(5)
const historyFilter = ref<HistoryStatusFilter>('all')
const historyLoading = ref(false)
const taskStats = ref<Pick<TaskListResponse, 'completed' | 'failed' | 'cancelled'>>({
  completed: 0,
  failed: 0,
  cancelled: 0,
})
const historyOverviewTotal = computed(() => taskStats.value.completed + taskStats.value.failed)

const selectedQueryId = ref('')
const reportLoading = ref(false)
const selectedReport = ref<AnalysisReport | null>(null)
const selectedNews = ref<NewsIntelItem[]>([])

// 详情区和历史弹窗共用同一套阶段解析能力，但各自维护独立状态，避免互相覆盖。
const stageItems = ref<AgentStageItem[]>([])
const stageSource = ref<'api' | 'mock' | 'derived'>('derived')
const stageMissingApis = ref<string[]>([])
const stageWarnings = ref<string[]>([])
const recentReportModalVisible = ref(false)
const recentReportModalLoading = ref(false)
const recentReportModalMode = ref<'report' | 'failed'>('report')
const recentReportModalTab = ref<'summary' | 'strategy' | 'stages' | 'news'>('summary')
const recentReportModalQueryId = ref('')
const recentReportModalReport = ref<AnalysisReport | null>(null)
const recentReportModalNews = ref<NewsIntelItem[]>([])
const recentReportModalFailedDetail = ref<{
  taskId: string
  stockCode: string
  stockName: string
  finishedAt: string
  errorMessage: string
} | null>(null)
const recentReportModalStageItems = ref<AgentStageItem[]>([])
const recentReportModalStageSource = ref<'api' | 'mock' | 'derived'>('derived')
const recentReportModalStageMissingApis = ref<string[]>([])
const recentReportModalStageWarnings = ref<string[]>([])
const recentReportModalError = ref('')

const tasksRefreshing = ref(false)
const lastStreamWarnAt = ref(0)
const streamEnabled = ref(true)

const {
  runningTasks,
  filteredRecentTasks,
  recentFilter,
  lastSyncedAt,
  handleEventTask,
  reconcileFromSnapshot,
  getTaskById,
} = useTaskQueueState()

const simulationStatus = computed(() => brokerAccountStore.simulationStatus)
const needsInit = computed(() => !simulationStatus.value?.isBound)
const needsVerify = computed(() => Boolean(simulationStatus.value?.isBound && !simulationStatus.value?.isVerified))

function stageSourceTypeOf(source: 'api' | 'mock' | 'derived'): 'success' | 'warning' | 'error' {
  if (source === 'api')
    return 'success'
  if (source === 'derived')
    return 'warning'
  return 'error'
}

function stageSourceTextOf(source: 'api' | 'mock' | 'derived'): string {
  if (source === 'api')
    return '真实接口数据'
  if (source === 'derived')
    return '派生数据'
  return '模拟数据'
}

const stageSourceType = computed<'success' | 'warning' | 'error'>(() => stageSourceTypeOf(stageSource.value))
const stageSourceText = computed(() => stageSourceTextOf(stageSource.value))
const recentReportModalStageSourceType = computed<'success' | 'warning' | 'error'>(() => stageSourceTypeOf(recentReportModalStageSource.value))
const recentReportModalStageSourceText = computed(() => stageSourceTextOf(recentReportModalStageSource.value))
const recentReportModalTitle = computed(() => {
  if (recentReportModalMode.value === 'failed') {
    if (!recentReportModalFailedDetail.value)
      return '失败详情'
    return `失败详情 · ${recentReportModalFailedDetail.value.stockCode}`
  }
  if (!recentReportModalReport.value)
    return '历史报告详情'
  return `历史报告详情 · ${recentReportModalReport.value.meta.stockCode}`
})

const RECENT_REPORT_MATCH_WINDOW_MS = 30 * 60 * 1000
const RECENT_RESULT_VISIBLE_LIMIT = 3

interface RecentResultDisplayItem {
  taskId: string
  stockCode: string
  stockName: string
  status: 'completed' | 'failed' | 'cancelled'
  finishedAt: string
  statusTagType: 'success' | 'error' | 'warning'
  summaryText: string
  queryId: string | null
  canOpenReport: boolean
  unmatchedReason: string
}

interface HistoryResultDisplayItem {
  key: string
  queryId: string
  taskId: string | null
  stockCode: string
  stockName: string
  finishedAt: string
  summaryText: string
  status: 'completed' | 'failed'
  statusTagType: 'success' | 'error'
  actionText: string
  canOpenDetail: boolean
}

interface AnalysisOverviewCard {
  key: string
  label: string
  value: number
  type: 'success' | 'warning' | 'error' | 'info' | 'default'
}

let fallbackPollTimer: number | null = null
let modalLoadSeq = 0

function resolveTaskId(queryId: string): string | null {
  const hit = getTaskById(queryId)
  return hit?.taskId || queryId || null
}

interface RefreshTaskOptions {
  reason?: 'init' | 'manual' | 'submit' | 'stream_connected' | 'stream_completed' | 'stream_terminal' | 'poll_fallback'
  silent?: boolean
}

async function refreshTasks(options: RefreshTaskOptions = {}) {
  if (tasksRefreshing.value)
    return

  tasksRefreshing.value = true
  try {
    const data = await getTaskList(undefined, 100)
    reconcileFromSnapshot(data.tasks)
    taskStats.value = {
      completed: data.completed,
      failed: data.failed,
      cancelled: data.cancelled,
    }
  }
  catch {
    if (!options.silent)
      window.$message.error('任务队列刷新失败')
  }
  finally {
    tasksRefreshing.value = false
  }
}

async function loadSimulationStatus(silent = false) {
  try {
    await brokerAccountStore.loadSimulationStatus()
  }
  catch {
    if (!silent)
      window.$message.error(brokerAccountStore.error || '加载模拟盘账户状态失败')
  }
}

const { isConnected } = useTaskStream({
  enabled: streamEnabled,
  onConnected: () => {
    void refreshTasks({ reason: 'stream_connected', silent: true })
  },
  onTaskCreated: handleEventTask,
  onTaskStarted: handleEventTask,
  onTaskCompleted: async (task) => {
    handleEventTask(task)
    await Promise.all([
      refreshHistory(true),
      refreshTasks({ reason: 'stream_completed', silent: true }),
    ])
  },
  onTaskFailed: (task) => {
    handleEventTask(task)
    void refreshTasks({ reason: 'stream_terminal', silent: true })
  },
  onTaskCancelled: (task) => {
    handleEventTask(task)
    void refreshTasks({ reason: 'stream_terminal', silent: true })
  },
  onError: () => {
    const now = Date.now()
    if (now - lastStreamWarnAt.value >= 15_000) {
      window.$message.warning('任务流连接中断，正在重连')
      lastStreamWarnAt.value = now
    }
  },
})

function startFallbackPolling() {
  stopFallbackPolling()
  // SSE 断开时退回短轮询，保证任务面板仍能持续更新。
  fallbackPollTimer = window.setInterval(() => {
    if (!isConnected.value)
      void refreshTasks({ reason: 'poll_fallback', silent: true })
  }, 8000)
}

function stopFallbackPolling() {
  if (fallbackPollTimer != null) {
    window.clearInterval(fallbackPollTimer)
    fallbackPollTimer = null
  }
}

function statusLabel(status: TaskInfo['status']): string {
  if (status === 'pending')
    return '排队中'
  if (status === 'processing')
    return '处理中'
  if (status === 'completed')
    return '已完成'
  if (status === 'cancelled')
    return '已取消'
  return '失败'
}

function historyStatusText(status: HistoryItem['status']): string {
  return status === 'completed' ? '成功' : '失败'
}

function resetMainReportState() {
  selectedQueryId.value = ''
  selectedReport.value = null
  selectedNews.value = []
  stageItems.value = []
  stageSource.value = 'derived'
  stageMissingApis.value = []
  stageWarnings.value = []
}

function resetRecentReportModalState() {
  recentReportModalQueryId.value = ''
  recentReportModalMode.value = 'report'
  recentReportModalReport.value = null
  recentReportModalNews.value = []
  recentReportModalFailedDetail.value = null
  recentReportModalStageItems.value = []
  recentReportModalStageSource.value = 'derived'
  recentReportModalStageMissingApis.value = []
  recentReportModalStageWarnings.value = []
  recentReportModalError.value = ''
}

function runningTaskTime(task: TaskInfo): string {
  return formatDateTime(task.startedAt || task.createdAt)
}

function toTimestamp(value: string | null | undefined): number {
  if (!value)
    return 0
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp))
    return 0
  return timestamp
}

const recentResultItems = computed<RecentResultDisplayItem[]>(() => {
  const items: RecentResultDisplayItem[] = []
  const visibleTasks = filteredRecentTasks.value.slice(0, RECENT_RESULT_VISIBLE_LIMIT)

  visibleTasks.forEach((task) => {
    const finishedAt = task.completedAt || task.createdAt

    if (task.status === 'failed') {
      items.push({
        taskId: task.taskId,
        stockCode: task.stockCode,
        stockName: task.stockName || '--',
        status: 'failed',
        finishedAt,
        statusTagType: 'error',
        summaryText: task.error || task.message || '任务失败（无详细错误）',
        queryId: null,
        canOpenReport: false,
        unmatchedReason: '未关联报告',
      })
      return
    }

    if (task.status === 'cancelled') {
      items.push({
        taskId: task.taskId,
        stockCode: task.stockCode,
        stockName: task.stockName || '--',
        status: 'cancelled',
        finishedAt,
        statusTagType: 'warning',
        summaryText: task.message || '任务已取消',
        queryId: null,
        canOpenReport: false,
        unmatchedReason: '任务未执行完成',
      })
      return
    }

    if (task.status !== 'completed')
      return

    const taskTimestamp = toTimestamp(finishedAt)
    const stockHistories = historyItems.value.filter(item => item.status === 'completed' && item.stockCode === task.stockCode)

    let hasBestMatch = false
    let bestMatchStockName = ''
    let bestMatchAdvice = ''
    let bestMatchQueryId: string | null = null
    let minTimeDiff = Number.POSITIVE_INFINITY

    stockHistories.forEach((item) => {
      const diff = Math.abs(taskTimestamp - toTimestamp(item.createdAt))
      if (diff < minTimeDiff) {
        minTimeDiff = diff
        hasBestMatch = true
        bestMatchStockName = item.stockName || ''
        bestMatchAdvice = item.operationAdvice || ''
        bestMatchQueryId = item.queryId || null
      }
    })

    const matched = hasBestMatch && minTimeDiff <= RECENT_REPORT_MATCH_WINDOW_MS
    const matchedQueryId = matched ? bestMatchQueryId : null

    // 完成态任务和历史报告不是同一接口来源，这里用股票代码 + 时间窗口做近似匹配。
    items.push({
      taskId: task.taskId,
      stockCode: task.stockCode,
      stockName: task.stockName || bestMatchStockName || '--',
      status: 'completed',
      finishedAt,
      statusTagType: 'success',
      summaryText: (matched ? bestMatchAdvice : '') || task.message || (matched ? '分析已完成' : '分析已完成，未在当前历史页匹配到报告'),
      queryId: matchedQueryId,
      canOpenReport: Boolean(matchedQueryId),
      unmatchedReason: matched ? '' : '未匹配历史记录',
    })
  })

  return items
})

const analysisOverviewCards = computed<AnalysisOverviewCard[]>(() => {
  return [
    {
      key: 'running',
      label: '运行中任务',
      value: runningTasks.value.length,
      type: 'info',
    },
    {
      key: 'completed',
      label: '成功总数',
      value: taskStats.value.completed,
      type: 'success',
    },
    {
      key: 'failed',
      label: '失败总数',
      value: taskStats.value.failed,
      type: taskStats.value.failed > 0 ? 'error' : 'default',
    },
    {
      key: 'history',
      label: '历史总数',
      value: historyOverviewTotal.value,
      type: 'warning',
    },
  ]
})

const historyResultItems = computed<HistoryResultDisplayItem[]>(() => {
  return historyItems.value.map((item) => {
    const isCompleted = item.status === 'completed'
    const queryId = item.queryId || ''
    const taskId = item.taskId || item.queryId || null

    return {
      key: `${item.status}:${taskId || queryId || `${item.stockCode}:${item.createdAt}`}`,
      queryId,
      taskId,
      stockCode: item.stockCode,
      stockName: item.stockName || '--',
      finishedAt: item.createdAt,
      summaryText: isCompleted
        ? item.operationAdvice || '--'
        : item.errorMessage || '分析失败（无详细错误）',
      status: item.status,
      statusTagType: isCompleted ? 'success' : 'error',
      actionText: isCompleted ? '查看报告' : '查看失败详情',
      canOpenDetail: isCompleted ? Boolean(queryId) : Boolean(taskId),
    }
  })
})

function overviewStatisticStyle(type: AnalysisOverviewCard['type']): CSSProperties | undefined {
  const colorMap: Record<Exclude<AnalysisOverviewCard['type'], 'default'>, string> = {
    info: themeVars.value.infoColor,
    success: themeVars.value.successColor,
    warning: themeVars.value.warningColor,
    error: themeVars.value.errorColor,
  }
  if (type === 'default')
    return undefined
  return { '--n-value-text-color': colorMap[type] } as CSSProperties
}

interface ReportDetailBundle {
  report: AnalysisReport
  newsItems: NewsIntelItem[]
  stageItems: AgentStageItem[]
  stageSource: 'api' | 'mock' | 'derived'
  stageMissingApis: string[]
  stageWarnings: string[]
}

async function loadReportDetailBundle(queryId: string): Promise<ReportDetailBundle> {
  const [report, news] = await Promise.all([
    getHistoryDetail(queryId),
    getHistoryNews(queryId, 20),
  ])
  const stageResult = await resolveAgentStages(resolveTaskId(queryId), report)
  return {
    report,
    newsItems: news.items,
    stageItems: stageResult.data.stages,
    stageSource: stageResult.dataSource,
    stageMissingApis: stageResult.missingApis,
    stageWarnings: stageResult.warnings,
  }
}

async function openReportModalByQueryId(queryId: string) {
  const currentSeq = ++modalLoadSeq
  recentReportModalVisible.value = true
  recentReportModalLoading.value = true
  resetRecentReportModalState()
  recentReportModalMode.value = 'report'
  recentReportModalTab.value = 'summary'
  recentReportModalQueryId.value = queryId

  try {
    const bundle = await loadReportDetailBundle(queryId)
    // 弹窗快速切换时只接受最后一次请求结果，避免旧响应回写当前内容。
    if (currentSeq !== modalLoadSeq)
      return
    recentReportModalReport.value = bundle.report
    recentReportModalNews.value = bundle.newsItems
    recentReportModalStageItems.value = bundle.stageItems
    recentReportModalStageSource.value = bundle.stageSource
    recentReportModalStageMissingApis.value = bundle.stageMissingApis
    recentReportModalStageWarnings.value = bundle.stageWarnings
  }
  catch {
    if (currentSeq !== modalLoadSeq)
      return
    recentReportModalReport.value = null
    recentReportModalNews.value = []
    recentReportModalStageItems.value = []
    recentReportModalStageSource.value = 'derived'
    recentReportModalStageMissingApis.value = []
    recentReportModalStageWarnings.value = []
    recentReportModalError.value = '加载历史报告详情失败，请稍后重试'
    window.$message.error('加载历史报告详情失败')
  }
  finally {
    if (currentSeq === modalLoadSeq)
      recentReportModalLoading.value = false
  }
}

async function openFailedHistoryResult(item: HistoryResultDisplayItem) {
  if (!item.taskId)
    return

  const currentSeq = ++modalLoadSeq
  recentReportModalVisible.value = true
  recentReportModalLoading.value = true
  resetRecentReportModalState()
  recentReportModalMode.value = 'failed'
  recentReportModalTab.value = 'summary'
  recentReportModalFailedDetail.value = {
    taskId: item.taskId,
    stockCode: item.stockCode,
    stockName: item.stockName || '--',
    finishedAt: item.finishedAt,
    errorMessage: item.summaryText || '分析失败（无详细错误）',
  }

  try {
    const [status, stageResult] = await Promise.all([
      getTaskStatus(item.taskId),
      resolveAgentStages(item.taskId, null),
    ])
    if (currentSeq !== modalLoadSeq)
      return

    recentReportModalFailedDetail.value = {
      taskId: item.taskId,
      stockCode: item.stockCode,
      stockName: item.stockName || '--',
      finishedAt: item.finishedAt,
      errorMessage: status.error || item.summaryText || '分析失败（无详细错误）',
    }
    recentReportModalStageItems.value = stageResult.data.stages
    recentReportModalStageSource.value = stageResult.dataSource
    recentReportModalStageMissingApis.value = stageResult.missingApis
    recentReportModalStageWarnings.value = stageResult.warnings
  }
  catch {
    if (currentSeq !== modalLoadSeq)
      return
    resetRecentReportModalState()
    recentReportModalMode.value = 'failed'
    recentReportModalFailedDetail.value = {
      taskId: item.taskId,
      stockCode: item.stockCode,
      stockName: item.stockName || '--',
      finishedAt: item.finishedAt,
      errorMessage: item.summaryText || '分析失败（无详细错误）',
    }
    recentReportModalError.value = '加载失败详情失败，请稍后重试'
    window.$message.error('加载失败详情失败')
  }
  finally {
    if (currentSeq === modalLoadSeq)
      recentReportModalLoading.value = false
  }
}

async function openRecentResult(item: RecentResultDisplayItem) {
  if (!item.queryId)
    return
  await openReportModalByQueryId(item.queryId)
}

async function openHistoryResult(item: HistoryResultDisplayItem) {
  if (item.status === 'failed') {
    await openFailedHistoryResult(item)
    return
  }

  if (!item.queryId)
    return

  await openReportModalByQueryId(item.queryId)
}

async function refreshHistory(resetPage = false) {
  historyLoading.value = true
  if (resetPage)
    historyPage.value = 1

  try {
    const result = await getHistoryList({
      page: historyPage.value,
      limit: historyLimit.value,
      status: historyFilter.value,
    })
    historyItems.value = result.items
    historyListTotal.value = result.total

    const currentSelectedExists = result.items.some(item => item.status === 'completed' && item.queryId === selectedQueryId.value)
    if (currentSelectedExists)
      return

    const firstCompleted = result.items.find(item => item.status === 'completed' && item.queryId)
    if (firstCompleted?.queryId) {
      await loadReport(firstCompleted.queryId)
      return
    }

    resetMainReportState()
  }
  finally {
    historyLoading.value = false
  }
}

async function loadReport(queryId: string) {
  selectedQueryId.value = queryId
  reportLoading.value = true
  try {
    const bundle = await loadReportDetailBundle(queryId)
    selectedReport.value = bundle.report
    selectedNews.value = bundle.newsItems
    stageItems.value = bundle.stageItems
    stageSource.value = bundle.stageSource
    stageMissingApis.value = bundle.stageMissingApis
    stageWarnings.value = bundle.stageWarnings
  }
  finally {
    reportLoading.value = false
  }
}

function validateExecution(): boolean {
  executionError.value = ''
  if (needsInit.value) {
    executionError.value = '请先初始化模拟盘账户'
    brokerAccountStore.openBindModal()
    return false
  }
  if (needsVerify.value) {
    executionError.value = '模拟盘账户尚未校验，请前往交易账户中心完成初始化校验'
    brokerAccountStore.openBindModal()
    return false
  }
  return true
}

function pretty(value: unknown): string {
  if (value == null)
    return '--'
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function stageStatusType(status: AgentStageItem['status']): 'success' | 'error' | 'warning' {
  if (status === 'done')
    return 'success'
  if (status === 'failed')
    return 'error'
  return 'warning'
}

function stageStatusText(status: AgentStageItem['status']): string {
  if (status === 'done')
    return '完成'
  if (status === 'failed')
    return '失败'
  return '等待'
}

async function submitAnalysis() {
  inputError.value = ''
  duplicateError.value = ''
  executionError.value = ''

  const { valid, message, normalized } = validateStockCode(stockCode.value)
  if (!valid) {
    inputError.value = message || '股票代码无效'
    return
  }

  if (!validateExecution())
    return

  submitting.value = true
  try {
    await analyzeAsync({
      stockCode: normalized,
      reportType: 'detailed',
      executionMode: executionMode.value,
    })
    // 提交成功后立刻刷新任务队列，后续再由 SSE/轮询持续把状态补齐。
    stockCode.value = ''
    window.$message.success('分析任务已提交')
    await refreshTasks({ reason: 'submit', silent: true })
  }
  catch (error: unknown) {
    if (error instanceof DuplicateTaskError) {
      duplicateError.value = `股票 ${error.stockCode} 已在队列中（任务 ${error.existingTaskId}）`
      return
    }

    const axiosError = error as { response?: { status?: number, data?: { message?: string, error?: string } } }
    const status = axiosError?.response?.status
    const message = axiosError?.response?.data?.message
    const code = axiosError?.response?.data?.error

    if (status === 502 || status === 503 || status === 504) {
      window.$message.error(message || '本地模拟盘服务异常，请稍后重试')
      return
    }

    if (status === 412 && code === 'simulation_account_required') {
      executionError.value = message || '请先初始化并校验模拟盘账户'
      return
    }

    window.$message.error(message || '提交分析失败')
  }
  finally {
    submitting.value = false
  }
}

function toAgentChatWithStock() {
  const value = stockCode.value.trim()
  router.push({
    path: '/analysis/agent-chat',
    query: value
      ? { stockCode: value }
      : {},
  })
}

watch(executionMode, () => {
  executionError.value = ''
})

watch(historyFilter, () => {
  void refreshHistory(true)
})

onMounted(async () => {
  startFallbackPolling()
  await Promise.all([
    refreshHistory(true),
    refreshTasks({ reason: 'init' }),
    loadSimulationStatus(true),
  ])
})

onUnmounted(() => {
  stopFallbackPolling()
})
</script>

<template>
  <n-space vertical :size="SPACING.lg">
    <!-- 顶部只负责发起分析任务；运行态和历史态展示放在下面两个区块。 -->
    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="24">
        <n-card title="提交分析任务" :size="CARD_DENSITY.default">
          <template #header-extra>
            <n-space :size="SPACING.sm" :wrap="true" align="center">
              <n-select v-model:value="executionMode" :options="executionModeOptions" style="width: 180px;" />
              <n-button tertiary @click="toAgentChatWithStock">
                去 Agent问股
              </n-button>
              <n-button type="primary" :loading="submitting" @click="submitAnalysis">
                提交分析
              </n-button>
            </n-space>
          </template>

          <n-space vertical :size="SPACING.md">
            <n-input
              v-model:value="stockCode"
              placeholder="输入股票代码，例如 600519 / 00700 / AAPL"
              clearable
              @keyup.enter="submitAnalysis"
            />

            <n-alert v-if="inputError" type="error" :show-icon="false">
              {{ inputError }}
            </n-alert>
            <n-alert v-if="executionError" type="error" :show-icon="false">
              {{ executionError }}
            </n-alert>
            <n-alert v-if="duplicateError" type="warning" :show-icon="false">
              {{ duplicateError }}
            </n-alert>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid
      :cols="DASHBOARD_LAYOUT.cols"
      :x-gap="DASHBOARD_LAYOUT.outerGap"
      :y-gap="DASHBOARD_LAYOUT.outerGap"
      responsive="screen"
      item-responsive
    >
      <n-grid-item
        v-for="item in analysisOverviewCards"
        :key="item.key"
        span="24 s:12 m:6 l:6"
      >
        <n-card embedded :size="CARD_DENSITY.embedded">
          <n-space vertical :size="SPACING.xs">
            <n-text depth="3">
              {{ item.label }}
            </n-text>
            <n-statistic :value="item.value" :precision="0" :style="overviewStatisticStyle(item.type)" />
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="8">
        <n-space vertical :size="SPACING.lg">
          <!-- 左侧聚焦“现在”：运行中任务和最近完成结果。 -->
          <n-card title="运行中任务" :size="CARD_DENSITY.default">
            <template #header-extra>
              <n-space align="center" :size="SPACING.sm">
                <n-text depth="3">
                  最近同步：{{ lastSyncedAt ? formatDateTime(lastSyncedAt) : '--' }}
                </n-text>
                <n-button tertiary size="small" :loading="tasksRefreshing" @click="refreshTasks({ reason: 'manual' })">
                  手动刷新
                </n-button>
              </n-space>
            </template>

            <n-empty v-if="runningTasks.length === 0" description="当前没有运行中的任务" />
            <n-timeline v-else>
              <n-timeline-item
                v-for="task in runningTasks"
                :key="task.taskId"
                :type="task.status === 'processing' ? 'info' : 'default'"
                :title="`${task.stockCode} · ${statusLabel(task.status)}`"
                :content="task.message || '--'"
                :time="runningTaskTime(task)"
              />
            </n-timeline>
          </n-card>

          <n-card title="最近结果" :size="CARD_DENSITY.default">
            <template #header-extra>
              <n-radio-group v-model:value="recentFilter" size="small">
                <n-radio-button value="all">
                  全部
                </n-radio-button>
                <n-radio-button value="completed">
                  完成
                </n-radio-button>
                <n-radio-button value="failed">
                  失败
                </n-radio-button>
                <n-radio-button value="cancelled">
                  已取消
                </n-radio-button>
              </n-radio-group>
            </template>

            <n-empty v-if="recentResultItems.length === 0" description="暂无最近完成、失败或取消任务" />
            <n-list v-else hoverable>
              <n-list-item v-for="item in recentResultItems" :key="item.taskId">
                <n-card embedded :size="CARD_DENSITY.embedded">
                  <n-space justify="space-between" align="center" :wrap="false" style="width: 100%;">
                    <n-space vertical :size="SPACING.sm" style="min-width: 0; flex: 1;">
                      <n-space :size="SPACING.sm" align="center" :wrap="true">
                        <n-text strong>
                          {{ item.stockCode }}
                        </n-text>
                        <n-text depth="3">
                          {{ item.stockName }}
                        </n-text>
                        <n-tag size="small" :type="item.statusTagType">
                          {{ statusLabel(item.status) }}
                        </n-tag>
                      </n-space>
                      <n-text depth="3">
                        完成时间：{{ formatDateTime(item.finishedAt) }}
                      </n-text>
                      <n-text :type="item.status === 'failed' ? 'error' : undefined">
                        {{ item.summaryText }}
                      </n-text>
                      <n-text v-if="item.unmatchedReason" depth="3">
                        {{ item.unmatchedReason }}
                      </n-text>
                    </n-space>
                    <n-button
                      size="small"
                      type="primary"
                      tertiary
                      style="flex-shrink: 0;"
                      :disabled="!item.canOpenReport"
                      @click="openRecentResult(item)"
                    >
                      {{ item.canOpenReport ? '查看报告' : '未关联报告' }}
                    </n-button>
                  </n-space>
                </n-card>
              </n-list-item>
            </n-list>
          </n-card>
        </n-space>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="16">
        <!-- 右侧聚焦“详情”：历史报告、阶段数据和新闻情报共用一个详情面板。 -->
        <n-card title="分析报告详情" :size="CARD_DENSITY.default">
          <template #header-extra>
            <n-popover trigger="hover">
              <template #trigger>
                <n-tag :type="stageSourceType">
                  {{ stageSourceText }}
                </n-tag>
              </template>
              <n-space vertical :size="SPACING.sm">
                <n-text>阶段来源：{{ stageSourceText }}</n-text>
                <n-text v-if="stageMissingApis.length > 0" depth="3">
                  缺失接口：{{ stageMissingApis.join(', ') }}
                </n-text>
              </n-space>
            </n-popover>
          </template>

          <n-spin :show="reportLoading">
            <template v-if="selectedReport">
              <n-tabs v-model:value="detailTab" type="line" animated>
                <n-tab-pane name="summary" tab="摘要">
                  <n-space vertical :size="SPACING.md">
                    <n-descriptions label-placement="left" bordered :column="2" size="small">
                      <n-descriptions-item label="股票代码">
                        {{ selectedReport.meta.stockCode }}
                      </n-descriptions-item>
                      <n-descriptions-item label="股票名称">
                        {{ selectedReport.meta.stockName }}
                      </n-descriptions-item>
                      <n-descriptions-item label="报告时间">
                        {{ formatDateTime(selectedReport.meta.createdAt) }}
                      </n-descriptions-item>
                      <n-descriptions-item label="情绪得分">
                        {{ selectedReport.summary.sentimentScore }}
                      </n-descriptions-item>
                    </n-descriptions>

                    <n-card embedded :size="CARD_DENSITY.embedded">
                      <n-space vertical :size="SPACING.sm">
                        <n-text depth="3">
                          分析摘要
                        </n-text>
                        <n-text>{{ selectedReport.summary.analysisSummary || '--' }}</n-text>
                        <n-divider />
                        <n-text depth="3">
                          操作建议
                        </n-text>
                        <n-text>{{ selectedReport.summary.operationAdvice || '--' }}</n-text>
                        <n-divider />
                        <n-text depth="3">
                          趋势预测
                        </n-text>
                        <n-text>{{ selectedReport.summary.trendPrediction || '--' }}</n-text>
                      </n-space>
                    </n-card>
                  </n-space>
                </n-tab-pane>

                <n-tab-pane name="strategy" tab="策略点位">
                  <n-descriptions bordered :column="2" size="small" label-placement="left">
                    <n-descriptions-item label="理想买点">
                      <n-tag v-if="selectedReport.strategy?.idealBuy" type="success">
                        {{ selectedReport.strategy.idealBuy }}
                      </n-tag>
                      <n-text v-else depth="3">
                        --
                      </n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="次级买点">
                      <n-tag v-if="selectedReport.strategy?.secondaryBuy" type="info">
                        {{ selectedReport.strategy.secondaryBuy }}
                      </n-tag>
                      <n-text v-else depth="3">
                        --
                      </n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="止损位">
                      <n-tag v-if="selectedReport.strategy?.stopLoss" type="error">
                        {{ selectedReport.strategy.stopLoss }}
                      </n-tag>
                      <n-text v-else depth="3">
                        --
                      </n-text>
                    </n-descriptions-item>
                    <n-descriptions-item label="止盈位">
                      <n-tag v-if="selectedReport.strategy?.takeProfit" type="success">
                        {{ selectedReport.strategy.takeProfit }}
                      </n-tag>
                      <n-text v-else depth="3">
                        --
                      </n-text>
                    </n-descriptions-item>
                  </n-descriptions>
                </n-tab-pane>

                <n-tab-pane name="stages" tab="四阶段详情">
                  <n-space vertical :size="SPACING.sm">
                    <n-alert v-for="item in stageWarnings" :key="item" type="warning" :show-icon="false">
                      {{ item }}
                    </n-alert>

                    <n-empty v-if="stageItems.length === 0" description="暂无阶段数据" />
                    <n-collapse v-else arrow-placement="right" accordion>
                      <n-collapse-item v-for="stage in stageItems" :key="stage.code" :name="stage.code" :title="stage.title">
                        <template #header-extra>
                          <n-tag size="small" :type="stageStatusType(stage.status)">
                            {{ stageStatusText(stage.status) }}
                          </n-tag>
                        </template>

                        <n-space vertical :size="SPACING.md">
                          <n-descriptions bordered :column="1" size="small" label-placement="left">
                            <n-descriptions-item label="阶段摘要">
                              {{ stage.summary || '--' }}
                            </n-descriptions-item>
                            <n-descriptions-item label="耗时">
                              {{ stage.durationMs != null ? `${stage.durationMs}ms` : '--' }}
                            </n-descriptions-item>
                            <n-descriptions-item v-if="stage.errorMessage" label="错误信息">
                              {{ stage.errorMessage }}
                            </n-descriptions-item>
                          </n-descriptions>

                          <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
                            <n-grid-item :span="24" :l-span="12">
                              <n-card embedded title="输入摘要" :size="CARD_DENSITY.embedded">
                                <n-scrollbar style="max-height: 300px;">
                                  <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.input) }}</pre>
                                </n-scrollbar>
                              </n-card>
                            </n-grid-item>
                            <n-grid-item :span="24" :l-span="12">
                              <n-card embedded title="输出摘要" :size="CARD_DENSITY.embedded">
                                <n-scrollbar style="max-height: 300px;">
                                  <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.output) }}</pre>
                                </n-scrollbar>
                              </n-card>
                            </n-grid-item>
                          </n-grid>
                        </n-space>
                      </n-collapse-item>
                    </n-collapse>
                  </n-space>
                </n-tab-pane>

                <n-tab-pane name="news" tab="新闻情报">
                  <n-empty v-if="selectedNews.length === 0" description="暂无新闻" />
                  <n-list v-else hoverable>
                    <n-list-item v-for="news in selectedNews" :key="news.url">
                      <n-space vertical :size="SPACING.sm">
                        <a :href="news.url" target="_blank" rel="noreferrer">{{ news.title }}</a>
                        <n-text depth="3">
                          {{ news.snippet }}
                        </n-text>
                      </n-space>
                    </n-list-item>
                  </n-list>
                </n-tab-pane>
              </n-tabs>
            </template>
            <n-empty v-else description="请选择历史记录查看详情" />
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="历史分析记录" :size="CARD_DENSITY.default">
      <template #header-extra>
        <n-radio-group v-model:value="historyFilter" size="small">
          <n-radio-button value="all">
            全部
          </n-radio-button>
          <n-radio-button value="completed">
            成功
          </n-radio-button>
          <n-radio-button value="failed">
            失败
          </n-radio-button>
        </n-radio-group>
      </template>

      <n-space vertical :size="SPACING.md">
        <n-spin :show="historyLoading">
          <n-empty v-if="historyResultItems.length === 0" description="暂无历史分析记录" />
          <n-list v-else hoverable>
            <n-list-item v-for="item in historyResultItems" :key="item.key">
              <n-card embedded :size="CARD_DENSITY.embedded">
                <n-space justify="space-between" align="center" :wrap="false" style="width: 100%;">
                  <n-space vertical :size="SPACING.sm" style="min-width: 0; flex: 1;">
                    <n-space :size="SPACING.sm" align="center" :wrap="true">
                      <n-text strong>
                        {{ item.stockCode }}
                      </n-text>
                      <n-text depth="3">
                        {{ item.stockName }}
                      </n-text>
                      <n-tag size="small" :type="item.statusTagType">
                        {{ historyStatusText(item.status) }}
                      </n-tag>
                    </n-space>
                    <n-text depth="3">
                      结束时间：{{ formatDateTime(item.finishedAt) }}
                    </n-text>
                    <n-ellipsis :line-clamp="2" tooltip :style="{ color: item.status === 'failed' ? themeVars.errorColor : undefined }">
                      {{ item.summaryText }}
                    </n-ellipsis>
                  </n-space>
                  <n-button
                    size="small"
                    type="primary"
                    tertiary
                    style="flex-shrink: 0;"
                    :disabled="!item.canOpenDetail"
                    @click="openHistoryResult(item)"
                  >
                    {{ item.actionText }}
                  </n-button>
                </n-space>
              </n-card>
            </n-list-item>
          </n-list>
        </n-spin>
        <n-pagination
          :page="historyPage"
          :item-count="historyListTotal"
          :page-size="historyLimit"
          @update:page="(page) => { historyPage = page; refreshHistory(); }"
        />
      </n-space>
    </n-card>

    <n-modal v-model:show="recentReportModalVisible" preset="card" :title="recentReportModalTitle" class="w-1200px max-w-95vw" closable>
      <template #header-extra>
        <n-popover trigger="hover">
          <template #trigger>
            <n-tag :type="recentReportModalStageSourceType">
              {{ recentReportModalStageSourceText }}
            </n-tag>
          </template>
          <n-space vertical :size="SPACING.sm">
            <n-text>阶段来源：{{ recentReportModalStageSourceText }}</n-text>
            <n-text v-if="recentReportModalStageMissingApis.length > 0" depth="3">
              缺失接口：{{ recentReportModalStageMissingApis.join(', ') }}
            </n-text>
          </n-space>
        </n-popover>
      </template>

      <n-spin :show="recentReportModalLoading">
        <n-alert v-if="recentReportModalError" type="error" :show-icon="false">
          {{ recentReportModalError }}
        </n-alert>

        <template v-if="recentReportModalMode === 'report' && recentReportModalReport">
          <n-tabs v-model:value="recentReportModalTab" type="line" animated>
            <n-tab-pane name="summary" tab="摘要">
              <n-space vertical :size="SPACING.md">
                <n-descriptions label-placement="left" bordered :column="2" size="small">
                  <n-descriptions-item label="股票代码">
                    {{ recentReportModalReport.meta.stockCode }}
                  </n-descriptions-item>
                  <n-descriptions-item label="股票名称">
                    {{ recentReportModalReport.meta.stockName }}
                  </n-descriptions-item>
                  <n-descriptions-item label="报告时间">
                    {{ formatDateTime(recentReportModalReport.meta.createdAt) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="情绪得分">
                    {{ recentReportModalReport.summary.sentimentScore }}
                  </n-descriptions-item>
                </n-descriptions>

                <n-card embedded :size="CARD_DENSITY.embedded">
                  <n-space vertical :size="SPACING.sm">
                    <n-text depth="3">
                      分析摘要
                    </n-text>
                    <n-text>{{ recentReportModalReport.summary.analysisSummary || '--' }}</n-text>
                    <n-divider />
                    <n-text depth="3">
                      操作建议
                    </n-text>
                    <n-text>{{ recentReportModalReport.summary.operationAdvice || '--' }}</n-text>
                    <n-divider />
                    <n-text depth="3">
                      趋势预测
                    </n-text>
                    <n-text>{{ recentReportModalReport.summary.trendPrediction || '--' }}</n-text>
                  </n-space>
                </n-card>
              </n-space>
            </n-tab-pane>

            <n-tab-pane name="strategy" tab="策略点位">
              <n-descriptions bordered :column="2" size="small" label-placement="left">
                <n-descriptions-item label="理想买点">
                  <n-tag v-if="recentReportModalReport.strategy?.idealBuy" type="success">
                    {{ recentReportModalReport.strategy.idealBuy }}
                  </n-tag>
                  <n-text v-else depth="3">
                    --
                  </n-text>
                </n-descriptions-item>
                <n-descriptions-item label="次级买点">
                  <n-tag v-if="recentReportModalReport.strategy?.secondaryBuy" type="info">
                    {{ recentReportModalReport.strategy.secondaryBuy }}
                  </n-tag>
                  <n-text v-else depth="3">
                    --
                  </n-text>
                </n-descriptions-item>
                <n-descriptions-item label="止损位">
                  <n-tag v-if="recentReportModalReport.strategy?.stopLoss" type="error">
                    {{ recentReportModalReport.strategy.stopLoss }}
                  </n-tag>
                  <n-text v-else depth="3">
                    --
                  </n-text>
                </n-descriptions-item>
                <n-descriptions-item label="止盈位">
                  <n-tag v-if="recentReportModalReport.strategy?.takeProfit" type="success">
                    {{ recentReportModalReport.strategy.takeProfit }}
                  </n-tag>
                  <n-text v-else depth="3">
                    --
                  </n-text>
                </n-descriptions-item>
              </n-descriptions>
            </n-tab-pane>

            <n-tab-pane name="stages" tab="四阶段详情">
              <n-space vertical :size="SPACING.sm">
                <n-alert v-for="item in recentReportModalStageWarnings" :key="item" type="warning" :show-icon="false">
                  {{ item }}
                </n-alert>

                <n-empty v-if="recentReportModalStageItems.length === 0" description="暂无阶段数据" />
                <n-collapse v-else arrow-placement="right" accordion>
                  <n-collapse-item v-for="stage in recentReportModalStageItems" :key="stage.code" :name="stage.code" :title="stage.title">
                    <template #header-extra>
                      <n-tag size="small" :type="stageStatusType(stage.status)">
                        {{ stageStatusText(stage.status) }}
                      </n-tag>
                    </template>

                    <n-space vertical :size="SPACING.md">
                      <n-descriptions bordered :column="1" size="small" label-placement="left">
                        <n-descriptions-item label="阶段摘要">
                          {{ stage.summary || '--' }}
                        </n-descriptions-item>
                        <n-descriptions-item label="耗时">
                          {{ stage.durationMs != null ? `${stage.durationMs}ms` : '--' }}
                        </n-descriptions-item>
                        <n-descriptions-item v-if="stage.errorMessage" label="错误信息">
                          {{ stage.errorMessage }}
                        </n-descriptions-item>
                      </n-descriptions>

                      <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
                        <n-grid-item :span="24" :l-span="12">
                          <n-card embedded title="输入摘要" :size="CARD_DENSITY.embedded">
                            <n-scrollbar style="max-height: 300px;">
                              <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.input) }}</pre>
                            </n-scrollbar>
                          </n-card>
                        </n-grid-item>
                        <n-grid-item :span="24" :l-span="12">
                          <n-card embedded title="输出摘要" :size="CARD_DENSITY.embedded">
                            <n-scrollbar style="max-height: 300px;">
                              <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.output) }}</pre>
                            </n-scrollbar>
                          </n-card>
                        </n-grid-item>
                      </n-grid>
                    </n-space>
                  </n-collapse-item>
                </n-collapse>
              </n-space>
            </n-tab-pane>

            <n-tab-pane name="news" tab="新闻情报">
              <n-empty v-if="recentReportModalNews.length === 0" description="暂无新闻" />
              <n-list v-else hoverable>
                <n-list-item v-for="news in recentReportModalNews" :key="news.url">
                  <n-space vertical :size="SPACING.sm">
                    <a :href="news.url" target="_blank" rel="noreferrer">{{ news.title }}</a>
                    <n-text depth="3">
                      {{ news.snippet }}
                    </n-text>
                  </n-space>
                </n-list-item>
              </n-list>
            </n-tab-pane>
          </n-tabs>
        </template>

        <template v-else-if="recentReportModalMode === 'failed' && recentReportModalFailedDetail">
          <n-tabs v-model:value="recentReportModalTab" type="line" animated>
            <n-tab-pane name="summary" tab="失败信息">
              <n-space vertical :size="SPACING.md">
                <n-descriptions label-placement="left" bordered :column="1" size="small">
                  <n-descriptions-item label="股票代码">
                    {{ recentReportModalFailedDetail.stockCode }}
                  </n-descriptions-item>
                  <n-descriptions-item label="股票名称">
                    {{ recentReportModalFailedDetail.stockName }}
                  </n-descriptions-item>
                  <n-descriptions-item label="结束时间">
                    {{ formatDateTime(recentReportModalFailedDetail.finishedAt) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="任务 ID">
                    {{ recentReportModalFailedDetail.taskId }}
                  </n-descriptions-item>
                  <n-descriptions-item label="任务状态">
                    <n-tag size="small" type="error">
                      失败
                    </n-tag>
                  </n-descriptions-item>
                </n-descriptions>

                <n-alert type="error" :show-icon="false">
                  {{ recentReportModalFailedDetail.errorMessage }}
                </n-alert>
              </n-space>
            </n-tab-pane>

            <n-tab-pane name="stages" tab="四阶段详情">
              <n-space vertical :size="SPACING.sm">
                <n-alert v-for="item in recentReportModalStageWarnings" :key="item" type="warning" :show-icon="false">
                  {{ item }}
                </n-alert>

                <n-empty v-if="recentReportModalStageItems.length === 0" description="暂无阶段数据" />
                <n-collapse v-else arrow-placement="right" accordion>
                  <n-collapse-item v-for="stage in recentReportModalStageItems" :key="stage.code" :name="stage.code" :title="stage.title">
                    <template #header-extra>
                      <n-tag size="small" :type="stageStatusType(stage.status)">
                        {{ stageStatusText(stage.status) }}
                      </n-tag>
                    </template>

                    <n-space vertical :size="SPACING.md">
                      <n-descriptions bordered :column="1" size="small" label-placement="left">
                        <n-descriptions-item label="阶段摘要">
                          {{ stage.summary || '--' }}
                        </n-descriptions-item>
                        <n-descriptions-item label="耗时">
                          {{ stage.durationMs != null ? `${stage.durationMs}ms` : '--' }}
                        </n-descriptions-item>
                        <n-descriptions-item v-if="stage.errorMessage" label="错误信息">
                          {{ stage.errorMessage }}
                        </n-descriptions-item>
                      </n-descriptions>

                      <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
                        <n-grid-item :span="24" :l-span="12">
                          <n-card embedded title="输入摘要" :size="CARD_DENSITY.embedded">
                            <n-scrollbar style="max-height: 300px;">
                              <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.input) }}</pre>
                            </n-scrollbar>
                          </n-card>
                        </n-grid-item>
                        <n-grid-item :span="24" :l-span="12">
                          <n-card embedded title="输出摘要" :size="CARD_DENSITY.embedded">
                            <n-scrollbar style="max-height: 300px;">
                              <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.output) }}</pre>
                            </n-scrollbar>
                          </n-card>
                        </n-grid-item>
                      </n-grid>
                    </n-space>
                  </n-collapse-item>
                </n-collapse>
              </n-space>
            </n-tab-pane>
          </n-tabs>
        </template>

        <n-empty v-else description="暂无可展示的历史详情" />
      </n-spin>
    </n-modal>
  </n-space>
</template>
