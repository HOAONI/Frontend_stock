<script setup lang="ts">
import { analyzeAsync, DuplicateTaskError, getHistoryDetail, getHistoryList, getHistoryNews, getTaskList } from '@/api/analysis'
import { useTaskQueueState } from '@/composables/useTaskQueueState'
import { useTaskStream } from '@/composables/useTaskStream'
import { GRID_GAP, SPACING } from '@/constants/design-tokens'
import { resolveAgentStages } from '@/services/analysis-service'
import { useBrokerAccountStore } from '@/store'
import type { AnalysisReport, HistoryItem, NewsIntelItem, TaskInfo } from '@/types/analysis'
import type { AgentStageItem } from '@/types/agent-stages'
import { formatDateTime, getRecentStartDate, toDateInputValue, validateStockCode } from '@/utils/stock'

const router = useRouter()
const brokerAccountStore = useBrokerAccountStore()

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
const historyTotal = ref(0)
const historyPage = ref(1)
const historyLimit = ref(20)
const historyLoading = ref(false)

const selectedQueryId = ref('')
const reportLoading = ref(false)
const selectedReport = ref<AnalysisReport | null>(null)
const selectedNews = ref<NewsIntelItem[]>([])

const stageItems = ref<AgentStageItem[]>([])
const stageSource = ref<'api' | 'mock' | 'derived'>('derived')
const stageMissingApis = ref<string[]>([])
const stageWarnings = ref<string[]>([])

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
const simulationStatusLoadFailed = computed(() => brokerAccountStore.simulationStatusLoadFailed)
const simulationStatusError = computed(() => brokerAccountStore.simulationStatusError || brokerAccountStore.error)
const needsInit = computed(() => !simulationStatus.value?.isBound)
const needsVerify = computed(() => Boolean(simulationStatus.value?.isBound && !simulationStatus.value?.isVerified))

const accountStatusType = computed<'error' | 'warning' | 'success'>(() => {
  if (simulationStatusLoadFailed.value)
    return 'error'
  if (needsInit.value || needsVerify.value)
    return 'warning'
  return 'success'
})

const accountStatusTitle = computed(() => {
  if (simulationStatusLoadFailed.value)
    return '模拟盘状态读取失败'
  if (needsInit.value)
    return '未初始化模拟账户'
  if (needsVerify.value)
    return '模拟账户待校验'
  return '模拟账户已就绪'
})

const accountStatusMessage = computed(() => {
  if (simulationStatusLoadFailed.value)
    return `后端或 Agent 服务异常，请先修复。${simulationStatusError.value || ''}`.trim()
  if (needsInit.value)
    return '请先完成模拟账户初始化，再提交分析任务。'
  if (needsVerify.value)
    return '请重新初始化并校验模拟账户，校验通过后才可自动下单。'
  return `当前账户：${simulationStatus.value?.accountDisplayName || simulationStatus.value?.accountUid || '--'}，可直接进行分析。`
})

const bindActionLabel = computed(() => {
  if (needsInit.value)
    return '立即初始化'
  if (needsVerify.value)
    return '重新初始化并校验'
  return '打开初始化弹窗'
})

const stageSourceType = computed<'success' | 'warning' | 'error'>(() => {
  if (stageSource.value === 'api')
    return 'success'
  if (stageSource.value === 'derived')
    return 'warning'
  return 'error'
})

const stageSourceText = computed(() => {
  if (stageSource.value === 'api')
    return '真实接口数据'
  if (stageSource.value === 'derived')
    return '派生数据'
  return '模拟数据'
})

const RECENT_REPORT_MATCH_WINDOW_MS = 30 * 60 * 1000

interface RecentResultDisplayItem {
  taskId: string
  stockCode: string
  stockName: string
  status: 'completed' | 'failed'
  finishedAt: string
  statusTagType: 'success' | 'error'
  summaryText: string
  queryId: string | null
  canOpenReport: boolean
  unmatchedReason: string
}

let fallbackPollTimer: number | null = null

function resolveTaskId(queryId: string): string | null {
  const hit = getTaskById(queryId)
  return hit?.taskId || queryId || null
}

interface RefreshTaskOptions {
  reason?: 'init' | 'manual' | 'submit' | 'stream_connected' | 'poll_fallback'
  silent?: boolean
}

async function refreshTasks(options: RefreshTaskOptions = {}) {
  if (tasksRefreshing.value)
    return

  tasksRefreshing.value = true
  try {
    const data = await getTaskList(undefined, 100)
    reconcileFromSnapshot(data.tasks)
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
    await refreshHistory(true)
  },
  onTaskFailed: (task) => {
    handleEventTask(task)
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
  return '失败'
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

  filteredRecentTasks.value.forEach((task) => {
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

    if (task.status !== 'completed')
      return

    const taskTimestamp = toTimestamp(finishedAt)
    const stockHistories = historyItems.value.filter(item => item.stockCode === task.stockCode)

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
        bestMatchQueryId = item.queryId
      }
    })

    const matched = hasBestMatch && minTimeDiff <= RECENT_REPORT_MATCH_WINDOW_MS
    const matchedQueryId = matched ? bestMatchQueryId : null

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

function openRecentResult(item: RecentResultDisplayItem) {
  if (!item.queryId)
    return
  detailTab.value = 'summary'
  void loadReport(item.queryId)
}

async function refreshHistory(resetPage = false) {
  historyLoading.value = true
  if (resetPage)
    historyPage.value = 1

  try {
    const result = await getHistoryList({
      page: historyPage.value,
      limit: historyLimit.value,
      startDate: getRecentStartDate(60),
      endDate: toDateInputValue(new Date()),
    })
    historyItems.value = result.items
    historyTotal.value = result.total

    if (!selectedQueryId.value && result.items.length > 0)
      await loadReport(result.items[0].queryId)
  }
  finally {
    historyLoading.value = false
  }
}

async function loadStages(taskId: string | null, report: AnalysisReport | null) {
  stageWarnings.value = []
  stageMissingApis.value = []

  try {
    const result = await resolveAgentStages(taskId, report)
    stageItems.value = result.data.stages
    stageSource.value = result.dataSource
    stageWarnings.value = result.warnings
    stageMissingApis.value = result.missingApis
  }
  catch {
    stageItems.value = []
    stageSource.value = 'derived'
    stageWarnings.value = ['阶段信息解析失败']
  }
}

async function loadReport(queryId: string) {
  selectedQueryId.value = queryId
  reportLoading.value = true
  try {
    const [report, news] = await Promise.all([
      getHistoryDetail(queryId),
      getHistoryNews(queryId, 20),
    ])
    selectedReport.value = report
    selectedNews.value = news.items
    await loadStages(resolveTaskId(queryId), report)
  }
  finally {
    reportLoading.value = false
  }
}

function validateExecution(): boolean {
  executionError.value = ''
  if (!simulationStatus.value?.isBound) {
    executionError.value = '请先初始化模拟盘账户'
    brokerAccountStore.openBindModal()
    return false
  }
  if (!simulationStatus.value.isVerified) {
    executionError.value = '模拟盘账户尚未校验，请前往交易账户中心完成初始化校验'
    brokerAccountStore.openBindModal()
    return false
  }
  return true
}

function openSimulationBindModal() {
  brokerAccountStore.openBindModal()
}

async function retrySimulationStatus() {
  await loadSimulationStatus()
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

watch(executionMode, () => {
  executionError.value = ''
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
    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="16">
        <n-card title="提交分析任务" size="small">
          <template #header-extra>
            <n-space :size="SPACING.sm" :wrap="true" align="center">
              <n-select v-model:value="executionMode" :options="executionModeOptions" style="width: 180px;" />
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

      <n-grid-item :span="24" :l-span="8">
        <n-card title="系统状态与入口" size="small">
          <n-space vertical :size="SPACING.md">
            <n-alert :type="accountStatusType" :show-icon="false">
              {{ accountStatusTitle }}：{{ accountStatusMessage }}
            </n-alert>

            <n-space :size="SPACING.sm" :wrap="true">
              <n-tag :type="isConnected ? 'success' : 'warning'">
                {{ isConnected ? 'SSE 已连接' : 'SSE 重连中' }}
              </n-tag>
              <n-tag v-if="simulationStatus?.accountDisplayName || simulationStatus?.accountUid" type="info">
                账户：{{ simulationStatus?.accountDisplayName || simulationStatus?.accountUid }}
              </n-tag>
            </n-space>

            <n-space :size="SPACING.sm" :wrap="true">
              <n-button v-if="simulationStatusLoadFailed" type="error" secondary @click="retrySimulationStatus">
                重新检查
              </n-button>
              <n-button
                v-if="needsInit || needsVerify || simulationStatusLoadFailed"
                :type="simulationStatusLoadFailed ? 'error' : 'warning'"
                secondary
                @click="openSimulationBindModal"
              >
                {{ bindActionLabel }}
              </n-button>
              <n-button tertiary @click="router.push('/profile/trading')">
                交易账户中心
              </n-button>
            </n-space>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="8">
        <n-space vertical :size="SPACING.lg">
          <n-card title="运行中任务" size="small">
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

          <n-card title="最近结果" size="small">
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
              </n-radio-group>
            </template>

            <n-empty v-if="recentResultItems.length === 0" description="暂无最近完成或失败任务" />
            <n-list v-else hoverable>
              <n-list-item v-for="item in recentResultItems" :key="item.taskId">
                <n-card embedded size="small">
                  <n-space vertical :size="SPACING.sm">
                    <n-space justify="space-between" align="start">
                      <n-space vertical :size="SPACING.xs">
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
                      </n-space>
                      <n-button
                        size="small"
                        type="primary"
                        tertiary
                        :disabled="!item.canOpenReport"
                        @click="openRecentResult(item)"
                      >
                        {{ item.canOpenReport ? '查看报告' : '未关联报告' }}
                      </n-button>
                    </n-space>
                    <n-text :type="item.status === 'failed' ? 'error' : undefined">
                      {{ item.summaryText }}
                    </n-text>
                    <n-text v-if="item.unmatchedReason" depth="3">
                      {{ item.unmatchedReason }}
                    </n-text>
                  </n-space>
                </n-card>
              </n-list-item>
            </n-list>
          </n-card>
        </n-space>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="16">
        <n-card title="分析报告详情" size="small">
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

                    <n-card embedded size="small">
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
                              <n-card embedded title="输入摘要" size="small">
                                <n-scrollbar style="max-height: 300px;">
                                  <pre style="white-space: pre-wrap; word-break: break-word;">{{ pretty(stage.input) }}</pre>
                                </n-scrollbar>
                              </n-card>
                            </n-grid-item>
                            <n-grid-item :span="24" :l-span="12">
                              <n-card embedded title="输出摘要" size="small">
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

    <n-card title="历史分析记录" size="small">
      <n-space vertical :size="SPACING.md">
        <n-data-table
          :loading="historyLoading"
          :single-line="false"
          size="small"
          :columns="[
            { title: '股票', key: 'stockCode' },
            { title: '建议', key: 'operationAdvice', ellipsis: { tooltip: true } },
            { title: '时间', key: 'createdAt', render: (row: any) => formatDateTime(row.createdAt) },
          ]"
          :data="historyItems"
          :row-key="(row: any) => row.queryId"
          :row-props="(row: any) => ({ onClick: () => loadReport(row.queryId) })"
        />
        <n-pagination
          :page="historyPage"
          :item-count="historyTotal"
          :page-size="historyLimit"
          @update:page="(page) => { historyPage = page; refreshHistory(); }"
        />
      </n-space>
    </n-card>
  </n-space>
</template>
