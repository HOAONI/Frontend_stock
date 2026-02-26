<script setup lang="ts">
import AgentStagePanel from '@/components/analysis/AgentStagePanel.vue'
import DataSourceBadge from '@/components/common/DataSourceBadge.vue'
import { analyzeAsync, DuplicateTaskError, getHistoryDetail, getHistoryList, getHistoryNews, getTaskList } from '@/api/analysis'
import { useTaskQueueState } from '@/composables/useTaskQueueState'
import { useTaskStream } from '@/composables/useTaskStream'
import { resolveAgentStages } from '@/services/analysis-service'
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'
import type { AnalysisReport, HistoryItem, NewsIntelItem, TaskInfo } from '@/types/analysis'
import type { AgentStageItem } from '@/types/agent-stages'
import { formatDateTime, formatPct, getRecentStartDate, toDateInputValue, validateStockCode } from '@/utils/stock'

const router = useRouter()

const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const stockCode = ref('')
const inputError = ref('')
const duplicateError = ref('')
const executionError = ref('')
const submitting = ref(false)
const executionMode = ref<'auto' | 'paper' | 'broker'>('auto')
const accountRefreshing = ref(false)

const executionModeOptions = [
  { label: 'Auto（自动）', value: 'auto' },
  { label: 'Paper（模拟）', value: 'paper' },
  { label: 'Broker（实盘）', value: 'broker' },
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

const selectedBrokerAccountId = computed<number | null>({
  get() {
    return brokerAccountStore.selectedAccountId
  },
  set(value) {
    brokerAccountStore.setSelectedAccount(value)
  },
})

const brokerAccountOptions = computed(() => {
  return brokerAccountStore.activeAccounts.map(item => ({
    label: `${item.accountDisplayName || item.accountUid} (${item.brokerCode})${item.isVerified ? '' : ' · 未校验'}`,
    value: item.id,
  }))
})

const selectedBrokerAccount = computed(() => brokerAccountStore.selectedAccount)
const overviewMeta = computed(() => tradingAccountStore.performance || tradingAccountStore.summary)

function toNumber(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n))
    return null
  return n
}

const overviewMetrics = computed(() => {
  const summary = tradingAccountStore.summary?.summary || {}
  const performance = tradingAccountStore.performance?.performance || {}

  const pick = (...values: unknown[]) => {
    for (const value of values) {
      const parsed = toNumber(value)
      if (parsed != null)
        return parsed
    }
    return null
  }

  return {
    totalAsset: pick(performance.totalAsset, summary.totalAsset, summary.totalEquity),
    cash: pick(performance.cash, summary.cash, summary.availableCash),
    marketValue: pick(performance.marketValue, summary.marketValue, summary.totalMarketValue),
    pnlDaily: pick(performance.pnlDaily, summary.pnlDaily, summary.dailyPnl, summary.todayPnl),
    pnlTotal: pick(performance.pnlTotal, summary.pnlTotal, summary.totalPnl, summary.profitTotal),
    returnPct: pick(performance.returnPct, summary.returnPct, summary.totalReturnPct, summary.profitRate),
  }
})

function formatAmount(value: number | null | undefined): string {
  if (value == null)
    return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
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

async function refreshAccountOverview(refresh = false, silent = false) {
  if (!selectedBrokerAccountId.value) {
    tradingAccountStore.clearData()
    return
  }

  accountRefreshing.value = true
  const result = await tradingAccountStore.loadOverview({
    brokerAccountId: selectedBrokerAccountId.value,
    refresh,
  })
  accountRefreshing.value = false

  if (!result.success && !silent && result.error && result.error !== 'stale_request') {
    window.$message.error(result.error)
  }
}

async function loadBrokerAccountsAndOverview(silent = false) {
  try {
    await brokerAccountStore.loadAccounts()
  }
  catch {
    if (!silent) {
      window.$message.error(brokerAccountStore.error || '加载交易账户失败')
    }
    return
  }

  await refreshAccountOverview(false, silent)
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

function recentTaskTime(task: TaskInfo): string {
  return formatDateTime(task.completedAt || task.createdAt)
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

  if (executionMode.value !== 'broker')
    return true

  const selected = selectedBrokerAccount.value
  if (!selected) {
    executionError.value = 'Broker 模式需要选择一个活跃账户'
    return false
  }
  if (selected.status !== 'active') {
    executionError.value = '所选账户已禁用，请切换为 active 账户'
    return false
  }
  if (!selected.isVerified) {
    executionError.value = '所选账户尚未通过校验，请前往交易账户中心先执行 verify'
    return false
  }
  return true
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
      ...(executionMode.value === 'broker'
        ? {
            brokerAccountId: selectedBrokerAccountId.value || undefined,
          }
        : executionMode.value === 'auto' && selectedBrokerAccountId.value
          ? {
              brokerAccountId: selectedBrokerAccountId.value,
            }
          : {}),
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

    const axiosError = error as { response?: { status?: number, data?: { message?: string } } }
    const status = axiosError?.response?.status
    const message = axiosError?.response?.data?.message

    if (status === 502 || status === 503 || status === 504) {
      window.$message.error(message || '券商网关异常，请稍后重试')
      return
    }

    window.$message.error(message || '提交分析失败')
  }
  finally {
    submitting.value = false
  }
}

watch(
  () => brokerAccountStore.selectedAccountId,
  () => {
    void refreshAccountOverview(false, true)
  },
)

watch([executionMode, selectedBrokerAccountId], () => {
  executionError.value = ''
})

onMounted(async () => {
  startFallbackPolling()
  await Promise.all([
    refreshHistory(true),
    refreshTasks({ reason: 'init' }),
    loadBrokerAccountsAndOverview(true),
  ])
})

onUnmounted(() => {
  stopFallbackPolling()
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="我的交易账户总览" size="small">
      <template #header-extra>
        <n-space align="center">
          <n-button quaternary size="small" @click="router.push('/profile/trading')">
            交易账户中心
          </n-button>
          <n-button
            size="small"
            :loading="tradingAccountStore.loadingOverview || accountRefreshing"
            @click="refreshAccountOverview(true)"
          >
            刷新资金数据
          </n-button>
        </n-space>
      </template>

      <n-spin :show="tradingAccountStore.loadingOverview || accountRefreshing">
        <n-empty
          v-if="brokerAccountStore.activeAccounts.length === 0"
          description="未配置可用交易账户，请先在交易账户中心新增并校验账户"
        />
        <template v-else>
          <n-space vertical :size="12">
            <n-space align="center" :wrap="true">
              <n-tag type="info">
                账户：{{ selectedBrokerAccount?.accountDisplayName || selectedBrokerAccount?.accountUid || '--' }}
              </n-tag>
              <n-tag :type="selectedBrokerAccount?.isVerified ? 'success' : 'warning'">
                {{ selectedBrokerAccount?.isVerified ? '已校验' : '未校验' }}
              </n-tag>
              <n-tag v-if="overviewMeta?.dataSource" type="default">
                来源：{{ overviewMeta?.dataSource }}
              </n-tag>
              <n-text depth="3">
                快照：{{ overviewMeta?.snapshotAt ? formatDateTime(overviewMeta?.snapshotAt) : '--' }}
              </n-text>
            </n-space>

            <n-descriptions bordered :column="3" size="small">
              <n-descriptions-item label="总资产">
                {{ formatAmount(overviewMetrics.totalAsset) }}
              </n-descriptions-item>
              <n-descriptions-item label="可用现金">
                {{ formatAmount(overviewMetrics.cash) }}
              </n-descriptions-item>
              <n-descriptions-item label="持仓市值">
                {{ formatAmount(overviewMetrics.marketValue) }}
              </n-descriptions-item>
              <n-descriptions-item label="当日盈亏">
                {{ formatAmount(overviewMetrics.pnlDaily) }}
              </n-descriptions-item>
              <n-descriptions-item label="累计盈亏">
                {{ formatAmount(overviewMetrics.pnlTotal) }}
              </n-descriptions-item>
              <n-descriptions-item label="收益率">
                {{ formatPct(overviewMetrics.returnPct, 2) }}
              </n-descriptions-item>
            </n-descriptions>

            <n-alert v-if="tradingAccountStore.overviewError" type="warning">
              {{ tradingAccountStore.overviewError }}
            </n-alert>
            <n-alert v-if="brokerAccountStore.error" type="warning">
              {{ brokerAccountStore.error }}
            </n-alert>
          </n-space>
        </template>
      </n-spin>
    </n-card>

    <n-card title="AI Agent 分析调度" size="small">
      <n-space align="center" :wrap="true">
        <n-input
          v-model:value="stockCode"
          placeholder="输入股票代码，例如 600519 / 00700 / AAPL"
          clearable
          style="width: 320px"
          @keyup.enter="submitAnalysis"
        />
        <n-select
          v-model:value="executionMode"
          :options="executionModeOptions"
          style="width: 180px"
        />
        <n-select
          v-model:value="selectedBrokerAccountId"
          clearable
          :options="brokerAccountOptions"
          :disabled="executionMode === 'paper'"
          placeholder="可选：指定交易账户"
          style="width: 320px"
        />
        <n-button type="primary" :loading="submitting" @click="submitAnalysis">
          提交分析
        </n-button>
        <n-tag :type="isConnected ? 'success' : 'warning'">
          {{ isConnected ? 'SSE 已连接' : 'SSE 重连中' }}
        </n-tag>
      </n-space>
      <n-alert type="info" :show-icon="false" class="mt-3">
        执行模式说明：paper 读取「个人配置 > Paper 运行参数」；broker 读取「交易账户中心」中已校验账户。
      </n-alert>
      <n-space vertical :size="8" class="mt-3">
        <n-alert v-if="inputError" type="error">
          {{ inputError }}
        </n-alert>
        <n-alert v-if="executionError" type="error">
          {{ executionError }}
        </n-alert>
        <n-alert v-if="duplicateError" type="warning">
          {{ duplicateError }}
        </n-alert>
      </n-space>
    </n-card>

    <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="8">
        <n-space vertical :size="16">
          <n-card title="运行中任务" size="small">
            <template #header-extra>
              <n-space align="center" :size="8">
                <n-text depth="3" class="text-12px">
                  最近同步：{{ lastSyncedAt ? formatDateTime(lastSyncedAt) : '--' }}
                </n-text>
                <n-button quaternary size="tiny" :loading="tasksRefreshing" @click="refreshTasks({ reason: 'manual' })">
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
            <n-empty v-if="filteredRecentTasks.length === 0" description="暂无最近完成或失败任务" />
            <n-timeline v-else>
              <n-timeline-item
                v-for="task in filteredRecentTasks"
                :key="task.taskId"
                :type="task.status === 'failed' ? 'error' : 'success'"
                :title="`${task.stockCode} · ${statusLabel(task.status)}`"
                :content="task.message || task.error || '--'"
                :time="recentTaskTime(task)"
              />
            </n-timeline>
          </n-card>

          <n-card title="历史分析记录" size="small">
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
              :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: () => loadReport(row.queryId) })"
            />
            <n-pagination
              class="mt-3"
              size="small"
              :page="historyPage"
              :item-count="historyTotal"
              :page-size="historyLimit"
              @update:page="(page) => { historyPage = page; refreshHistory(); }"
            />
          </n-card>
        </n-space>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="16">
        <n-card title="分析报告详情" size="small">
          <n-spin :show="reportLoading">
            <template v-if="selectedReport">
              <n-space vertical :size="12">
                <n-space justify="space-between" align="center" :wrap="true">
                  <n-descriptions label-placement="left" bordered :column="2">
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
                  <DataSourceBadge :source="stageSource" :missing-apis="stageMissingApis" />
                </n-space>

                <n-card embedded title="摘要">
                  <n-space vertical :size="8">
                    <div><b>分析摘要：</b>{{ selectedReport.summary.analysisSummary }}</div>
                    <div><b>操作建议：</b>{{ selectedReport.summary.operationAdvice }}</div>
                    <div><b>趋势预测：</b>{{ selectedReport.summary.trendPrediction }}</div>
                  </n-space>
                </n-card>

                <n-card embedded title="策略点位">
                  <n-space vertical :size="8">
                    <div>理想买点：{{ selectedReport.strategy?.idealBuy || '--' }}</div>
                    <div>次级买点：{{ selectedReport.strategy?.secondaryBuy || '--' }}</div>
                    <div>止损位：{{ selectedReport.strategy?.stopLoss || '--' }}</div>
                    <div>止盈位：{{ selectedReport.strategy?.takeProfit || '--' }}</div>
                  </n-space>
                </n-card>

                <n-card embedded title="Agent 四阶段详情">
                  <n-alert v-for="item in stageWarnings" :key="item" class="mb-2" type="warning">
                    {{ item }}
                  </n-alert>
                  <AgentStagePanel :stages="stageItems" />
                </n-card>

                <n-card embedded title="新闻情报">
                  <n-empty v-if="selectedNews.length === 0" description="暂无新闻" />
                  <n-list v-else hoverable clickable>
                    <n-list-item v-for="news in selectedNews" :key="news.url">
                      <a :href="news.url" target="_blank" rel="noreferrer">{{ news.title }}</a>
                      <div class="text-12px text-color3 mt-1">
                        {{ news.snippet }}
                      </div>
                    </n-list-item>
                  </n-list>
                </n-card>
              </n-space>
            </template>
            <n-empty v-else description="请选择历史记录查看详情" />
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>
  </n-space>
</template>
