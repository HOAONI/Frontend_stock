import { getReservedTaskStages } from '@/api/reserved-analysis'
import type { SelectOption } from 'naive-ui'
import {
  cancelSchedulerTask,
  getSchedulerHealth,
  getSchedulerOverview,
  getSchedulerTaskDetail,
  listSchedulerTasks,
  rerunSchedulerTask,
  retrySchedulerTask,
  updateSchedulerTaskPriority,
} from '@/api/analysis-scheduler'
import { useSessionStore } from '@/store'
import type {
  SchedulerHealth,
  SchedulerOverview,
  SchedulerScope,
  SchedulerTaskDetail,
  SchedulerTaskItem,
  SchedulerTaskStatus,
} from '@/types/analysis-scheduler'
import type { AgentStageItem } from '@/types/agent-stages'
import type {
  SchedulerActionState,
  SchedulerActivityItem,
  SchedulerAlertItem,
  SchedulerDetailView,
  SchedulerFieldItem,
  SchedulerFilterForm,
  SchedulerHealthItem,
  SchedulerHeroView,
  SchedulerMetricItem,
  SchedulerOption,
  SchedulerPolicyItem,
  SchedulerQueuePreviewItem,
  SchedulerSelectedTaskView,
  SchedulerSpotlightTaskItem,
  SchedulerTagItem,
  SchedulerTaskCardView,
  SchedulerTaskTableRow,
  SchedulerTimelineItem,
} from '@/types/analysis-scheduler-view'
import { getSystemConfigFieldDisplay } from '@/utils/system-config-display'

const DEFAULT_PAGE_SIZE = 20

const STATUS_OPTIONS: SelectOption[] = [
  { label: '全部状态', value: '' },
  { label: '排队中', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
]

const EXECUTION_MODE_OPTIONS: SelectOption[] = [
  { label: '全部模式', value: '' },
  { label: '仅分析 (paper)', value: 'paper' },
  { label: '模拟执行 (broker)', value: 'broker' },
]

const SCOPE_OPTIONS: SchedulerOption<SchedulerScope>[] = [
  { label: '我的任务', value: 'mine' },
  { label: '全局队列', value: 'all' },
]

const POLICY_KEYS = [
  { key: 'runWorkerInApi', envKey: 'RUN_WORKER_IN_API' },
  { key: 'agentTaskPollIntervalMs', envKey: 'AGENT_TASK_POLL_INTERVAL_MS' },
  { key: 'agentTaskPollTimeoutMs', envKey: 'AGENT_TASK_POLL_TIMEOUT_MS' },
  { key: 'agentTaskPollMaxRetries', envKey: 'AGENT_TASK_POLL_MAX_RETRIES' },
  { key: 'analysisTaskStaleTimeoutMs', envKey: 'ANALYSIS_TASK_STALE_TIMEOUT_MS' },
  { key: 'schedulerHeartbeatTtlMs', envKey: 'SCHEDULER_HEARTBEAT_TTL_MS' },
] as const

function createDefaultFilters(): SchedulerFilterForm {
  return {
    status: null,
    stockCode: '',
    username: '',
    executionMode: null,
    staleOnly: false,
    dateRange: null,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

function padDate(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateParam(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`
}

function formatDateTime(value?: string | null): string {
  if (!value)
    return '--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return value

  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())} ${padDate(date.getHours())}:${padDate(date.getMinutes())}:${padDate(date.getSeconds())}`
}

function formatDurationMs(value?: number | null): string {
  const ms = Number(value || 0)
  if (!Number.isFinite(ms) || ms <= 0)
    return '--'
  if (ms < 1000)
    return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60)
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} 秒`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.round(seconds % 60)
  if (minutes < 60)
    return `${minutes} 分 ${remainSeconds} 秒`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours} 小时 ${remainMinutes} 分`
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

function formatPolicyValue(value: unknown): string {
  if (typeof value === 'boolean')
    return value ? '开启' : '关闭'
  if (value == null || value === '')
    return '--'
  return String(value)
}

function statusLabel(status: SchedulerTaskStatus): string {
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

function statusTone(status: SchedulerTaskStatus): SchedulerTagItem['type'] {
  if (status === 'pending')
    return 'warning'
  if (status === 'processing')
    return 'info'
  if (status === 'completed')
    return 'success'
  if (status === 'cancelled')
    return 'default'
  return 'error'
}

function executionModeLabel(mode: SchedulerTaskItem['executionMode']): string {
  return mode === 'broker' ? '模拟执行' : '仅分析'
}

function requestedExecutionModeLabel(mode: SchedulerTaskItem['requestedExecutionMode']): string {
  return mode === 'paper' ? 'Paper' : 'Auto'
}

function workerModeLabel(mode?: string | null): string {
  return mode === 'embedded' ? 'API 内嵌' : '独立 Worker'
}

function resolveOwnerLabel(task: SchedulerTaskItem): string {
  return task.ownerDisplayName || task.ownerUsername || (task.ownerUserId != null ? `用户#${task.ownerUserId}` : '系统')
}

function progressPercent(value?: number | null): number {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric))
    return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function progressLabel(task: SchedulerTaskItem): string {
  if (task.status === 'completed')
    return '100%'
  if (task.status === 'processing')
    return `${progressPercent(task.progress)}%`
  if (task.status === 'pending')
    return '待执行'
  if (task.status === 'cancelled')
    return '已取消'
  return '失败'
}

function taskMessage(task: SchedulerTaskItem): string {
  return task.message || task.error || '--'
}

function taskMessageTone(task: SchedulerTaskItem): Exclude<SchedulerTagItem['type'], 'default' | 'primary'> {
  if (task.isStale || task.status === 'failed')
    return 'error'
  if (task.status === 'completed')
    return 'success'
  if (task.status === 'pending')
    return 'warning'
  return 'info'
}

function stageTitle(code: AgentStageItem['code']) {
  if (code === 'data')
    return '数据获取 Agent'
  if (code === 'signal')
    return '信号策略 Agent'
  if (code === 'risk')
    return '风险控制 Agent'
  return '执行 Agent'
}

function canRetry(task: SchedulerTaskItem | null): boolean {
  return task?.status === 'failed'
}

function canRerun(task: SchedulerTaskItem | null): boolean {
  return task?.status === 'completed' || task?.status === 'failed'
}

function canCancel(task: SchedulerTaskItem | null): boolean {
  return task?.status === 'pending'
}

function buildTaskTags(task: SchedulerTaskItem): SchedulerTagItem[] {
  const tags: SchedulerTagItem[] = [
    { key: 'status', label: statusLabel(task.status), type: statusTone(task.status) },
    { key: 'execution-mode', label: executionModeLabel(task.executionMode), type: task.executionMode === 'broker' ? 'success' : 'default' },
    { key: 'requested-mode', label: requestedExecutionModeLabel(task.requestedExecutionMode), type: task.requestedExecutionMode === 'auto' ? 'info' : 'default' },
    { key: 'attempt', label: `第 ${task.attemptNo} 次`, type: 'default' },
    { key: 'priority', label: `优先级 ${task.priority}`, type: 'default' },
  ]

  if (task.status === 'processing' || task.status === 'completed') {
    tags.push({
      key: 'progress',
      label: `进度 ${progressPercent(task.progress)}%`,
      type: 'info',
    })
  }

  if (task.isStale) {
    tags.push({
      key: 'stale',
      label: '异常任务',
      type: 'error',
    })
  }

  return tags
}

function buildTaskMetaFields(task: SchedulerTaskItem): SchedulerFieldItem[] {
  return [
    { key: 'owner', label: '提交人', value: resolveOwnerLabel(task) },
    { key: 'report-type', label: '报告类型', value: task.reportType || '--' },
    { key: 'created-at', label: '提交时间', value: formatDateTime(task.createdAt) },
    { key: 'started-at', label: '开始执行', value: formatDateTime(task.startedAt) },
    { key: 'progress', label: '当前进度', value: progressLabel(task) },
    { key: 'task-id', label: '任务 ID', value: task.taskId },
  ]
}

function buildQueueFields(task: SchedulerTaskItem): SchedulerFieldItem[] {
  return [
    { key: 'owner', label: '提交人', value: resolveOwnerLabel(task) },
    { key: 'attempt', label: '尝试次数', value: `第 ${task.attemptNo} 次` },
    { key: 'priority', label: '优先级', value: String(task.priority) },
    { key: 'task-id', label: '任务 ID', value: task.taskId },
  ]
}

function buildTimelineFields(task: SchedulerTaskItem): SchedulerFieldItem[] {
  return [
    { key: 'created-at', label: '提交', value: formatDateTime(task.createdAt) },
    { key: 'started-at', label: '开始', value: formatDateTime(task.startedAt) },
    { key: 'completed-at', label: '结束', value: formatDateTime(task.completedAt) },
  ]
}

function timelineType(status: SchedulerTaskStatus): Exclude<SchedulerTagItem['type'], 'primary'> {
  if (status === 'completed')
    return 'success'
  if (status === 'failed')
    return 'error'
  if (status === 'processing')
    return 'info'
  if (status === 'pending')
    return 'warning'
  return 'default'
}

export function useSchedulerCenter() {
  const sessionStore = useSessionStore()

  const loading = ref(false)
  const overviewLoading = ref(false)
  const healthLoading = ref(false)
  const detailLoading = ref(false)
  const prioritySaving = ref(false)

  const scope = ref<SchedulerScope>('mine')
  const page = ref(1)
  const limit = ref(DEFAULT_PAGE_SIZE)
  const total = ref(0)

  const filters = ref<SchedulerFilterForm>(createDefaultFilters())

  const rows = ref<SchedulerTaskItem[]>([])
  const selectedTaskId = ref<string | null>(null)
  const overview = ref<SchedulerOverview | null>(null)
  const health = ref<SchedulerHealth | null>(null)

  const detailVisible = ref(false)
  const detailData = ref<SchedulerTaskDetail | null>(null)
  const detailStages = ref<AgentStageItem[]>([])
  const detailStageWarning = ref('')

  const priorityVisible = ref(false)
  const priorityDraft = ref<number | null>(100)

  const isAdmin = computed(() => sessionStore.isAdmin)

  const selectedTask = computed(() => {
    if (!selectedTaskId.value)
      return null
    return rows.value.find(item => item.taskId === selectedTaskId.value) || detailData.value?.task || null
  })

  const scopeLabel = computed(() => scope.value === 'all' ? '全局队列' : '我的任务')

  const controllerSummary = computed(() => {
    const data = overview.value
    if (!data)
      return '正在同步调度总览、健康状态与策略快照。'

    if (data.staleProcessingCount > 0)
      return `当前存在 ${data.staleProcessingCount} 条疑似卡死任务，建议优先排查 Worker 心跳和任务链路。`

    if (data.pendingCount > 0)
      return `当前 ${scopeLabel.value} 中有 ${data.pendingCount} 条任务等待执行，最老等待 ${formatDurationMs(data.oldestPendingWaitMs)}。`

    if (data.processingCount > 0)
      return `当前有 ${data.processingCount} 条任务正在处理中，调度链路保持活跃。`

    return '当前队列压力较低，未发现需要立即介入的异常。'
  })

  const controllerHighlights = computed(() => {
    const data = overview.value
    const healthData = health.value
    return [
      { key: 'scope', label: '当前视图', value: scopeLabel.value },
      { key: 'queue-depth', label: '队列深度', value: data ? String(data.queueDepth) : '--' },
      { key: 'worker-mode', label: 'Worker 模式', value: healthData ? workerModeLabel(healthData.workerMode) : '--' },
      { key: '24h', label: '24h 完成 / 失败', value: data ? `${data.completed24h} / ${data.failed24h}` : '--' },
    ]
  })

  const heroView = computed<SchedulerHeroView>(() => ({
    isAdmin: isAdmin.value,
    scope: scope.value,
    scopeOptions: SCOPE_OPTIONS,
    scopeLabel: scopeLabel.value,
    summary: controllerSummary.value,
    updatedAt: overview.value ? formatDateTime(overview.value.updatedAt) : '--',
    loading: overviewLoading.value || healthLoading.value || loading.value,
    highlights: controllerHighlights.value,
  }))

  const overviewCards = computed<SchedulerMetricItem[]>(() => {
    const data = overview.value
    if (!data)
      return []

    return [
      { key: 'pending', label: '排队任务', value: data.pendingCount, type: 'warning', hint: '等待 Worker 出队执行的任务数。' },
      { key: 'processing', label: '处理中', value: data.processingCount, type: 'info', hint: '当前已被 Worker 锁定并正在执行中的任务数。' },
      { key: 'failed', label: '失败任务', value: data.failedCount, type: 'error', hint: '需要人工排查、重试或重跑的失败任务数。' },
      { key: 'rate', label: '24h 成功率', value: data.successRate24h == null ? '--' : `${data.successRate24h}%`, type: 'success', hint: '最近 24 小时内完成任务占已完成+失败任务的比例。' },
      { key: 'wait', label: '最老待执行时长', value: formatDurationMs(data.oldestPendingWaitMs), type: 'warning', hint: '当前最久未被消费的待执行任务等待时长。' },
      {
        key: 'stale',
        label: '异常处理中任务',
        value: data.staleProcessingCount,
        type: data.staleProcessingCount > 0 ? 'error' : 'success',
        hint: '处理时间超过阈值的疑似卡死任务数。',
      },
    ]
  })

  const rowStatusCounts = computed(() => {
    return rows.value.reduce((acc, task) => {
      if (task.status === 'pending')
        acc.pending += 1
      if (task.status === 'processing')
        acc.processing += 1
      if (task.status === 'failed')
        acc.failed += 1
      if (task.isStale)
        acc.stale += 1
      return acc
    }, {
      pending: 0,
      processing: 0,
      failed: 0,
      stale: 0,
    })
  })

  const overviewSummaryCards = computed<SchedulerMetricItem[]>(() => {
    const data = overview.value
    const abnormalCount = data ? data.failedCount + data.staleProcessingCount : '--'
    return [
      {
        key: 'running',
        label: '运行任务数',
        value: data ? data.processingCount : '--',
        type: data && data.processingCount > 0 ? 'info' : 'default',
        hint: '当前已被 Worker 锁定并正在执行中的任务数。',
      },
      {
        key: 'abnormal',
        label: '异常任务数',
        value: abnormalCount,
        type: data && Number(abnormalCount) > 0 ? 'error' : 'success',
        hint: '失败任务与疑似卡死任务的总和。',
      },
      {
        key: 'queue-depth',
        label: '队列压力',
        value: data ? data.queueDepth : '--',
        type: data && data.queueDepth > 0 ? 'warning' : 'success',
        hint: '当前队列深度，越高说明待消化任务越多。',
      },
      {
        key: 'success-rate',
        label: '24h 成功率',
        value: data?.successRate24h == null ? '--' : `${data.successRate24h}%`,
        type: data && (data.successRate24h ?? 0) < 80 ? 'warning' : 'success',
        hint: '最近 24 小时完成任务占完成加失败任务的比例。',
      },
    ]
  })

  const currentFocusCards = computed<SchedulerMetricItem[]>(() => [
    {
      key: 'pending',
      label: '待处理',
      value: rowStatusCounts.value.pending,
      type: rowStatusCounts.value.pending > 0 ? 'warning' : 'success',
      hint: '当前列表中仍在等待出队执行的任务。',
    },
    {
      key: 'processing',
      label: '处理中',
      value: rowStatusCounts.value.processing,
      type: rowStatusCounts.value.processing > 0 ? 'info' : 'default',
      hint: '当前页中正在由 Worker 处理的任务。',
    },
    {
      key: 'failed',
      label: '需重试',
      value: rowStatusCounts.value.failed,
      type: rowStatusCounts.value.failed > 0 ? 'error' : 'success',
      hint: '失败后可以人工重试或重跑的任务。',
    },
    {
      key: 'stale',
      label: '疑似卡死',
      value: rowStatusCounts.value.stale,
      type: rowStatusCounts.value.stale > 0 ? 'error' : 'success',
      hint: '处理时长超阈值，建议优先排查链路。',
    },
  ])

  const queueHealthCards = computed<SchedulerMetricItem[]>(() => {
    const data = overview.value
    return [
      {
        key: 'queue-depth',
        label: '队列深度',
        value: data ? data.queueDepth : '--',
        type: data && data.queueDepth > 0 ? 'warning' : 'success',
        hint: '当前待执行与处理中任务构成的整体压力。',
      },
      {
        key: 'oldest-wait',
        label: '最老等待',
        value: data ? formatDurationMs(data.oldestPendingWaitMs) : '--',
        type: data && data.oldestPendingWaitMs > 10 * 60 * 1000 ? 'warning' : 'default',
        hint: '最长时间仍未被消费的待执行任务等待时长。',
      },
      {
        key: 'completed24h',
        label: '24h 完成',
        value: data ? data.completed24h : '--',
        type: 'success',
        hint: '最近 24 小时已完成任务数。',
      },
      {
        key: 'failed24h',
        label: '24h 失败',
        value: data ? data.failed24h : '--',
        type: data && data.failed24h > 0 ? 'error' : 'success',
        hint: '最近 24 小时失败任务数。',
      },
    ]
  })

  const priorityAlerts = computed<SchedulerAlertItem[]>(() => {
    const overviewData = overview.value
    const healthData = health.value

    if (!overviewData || !healthData) {
      return [
        { key: 'loading-worker', title: '正在同步 Worker 状态', content: '系统正在拉取最新健康检查结果。', type: 'info' },
        { key: 'loading-queue', title: '正在同步队列压力', content: '系统正在拉取最新队列概览与任务摘要。', type: 'info' },
        { key: 'loading-policy', title: '正在同步策略快照', content: '策略阈值和运行参数稍后可见。', type: 'default' },
      ]
    }

    const alerts: SchedulerAlertItem[] = [
      {
        key: 'worker',
        title: healthData.workerHealthy ? 'Worker 心跳正常' : 'Worker 心跳异常',
        content: healthData.workerHealthy
          ? `最新心跳 ${formatDateTime(healthData.workerHeartbeat?.lastSeenAt)}，当前为 ${workerModeLabel(healthData.workerMode)}。`
          : 'Worker 心跳已超时，任务执行链路可能已经停滞。',
        type: healthData.workerHealthy ? 'success' : 'error',
      },
      {
        key: 'stale',
        title: overviewData.staleProcessingCount > 0 ? `${overviewData.staleProcessingCount} 条任务疑似卡死` : '无异常处理中任务',
        content: overviewData.staleProcessingCount > 0
          ? '建议优先检查 Worker 心跳、轮询参数与任务执行阶段。'
          : '当前未发现超过阈值的处理中任务。',
        type: overviewData.staleProcessingCount > 0 ? 'error' : 'success',
      },
    ]

    if (overviewData.failedCount > 0) {
      alerts.push({
        key: 'failed',
        title: `${overviewData.failedCount} 条失败任务待处理`,
        content: '可以直接切换到失败任务筛选，集中执行重试或重跑。',
        type: 'warning',
      })
    }
    else {
      alerts.push({
        key: 'pending',
        title: overviewData.pendingCount > 0 ? `${overviewData.pendingCount} 条任务等待执行` : '队列压力较低',
        content: overviewData.pendingCount > 0
          ? `最老等待 ${formatDurationMs(overviewData.oldestPendingWaitMs)}。`
          : '当前待执行积压较少，可以直接关注新增任务。',
        type: overviewData.pendingCount > 0 ? 'info' : 'success',
      })
    }

    return alerts
  })

  const healthSummary = computed(() => {
    const data = health.value
    if (!data)
      return '正在读取 Backend、Agent 与 Worker 的实时健康状态。'
    if (!data.workerHealthy)
      return 'Worker 心跳异常，队列执行链路可能已经停滞。'
    if (!data.backendReady || !data.agentLive || !data.agentReady)
      return '基础服务存在未就绪节点，建议结合下方矩阵逐项排查。'
    return 'Backend、Agent 与 Worker 已联通，当前调度链路整体可用。'
  })

  const healthItems = computed<SchedulerHealthItem[]>(() => {
    const data = health.value
    if (!data)
      return []

    return [
      {
        key: 'backend',
        label: 'Backend Ready',
        ok: data.backendReady,
        hint: data.backendReady ? 'Backend 数据库与基础依赖可用。' : 'Backend readiness 检查失败。',
      },
      {
        key: 'agent-live',
        label: 'Agent Live',
        ok: data.agentLive,
        hint: data.agentLive ? 'Agent 服务存活。' : data.agentLiveError || 'Agent live 检查失败。',
      },
      {
        key: 'agent-ready',
        label: 'Agent Ready',
        ok: data.agentReady,
        hint: data.agentReady ? 'Agent 已准备好处理请求。' : data.agentReadyError || 'Agent ready 检查失败。',
      },
      {
        key: 'worker',
        label: 'Worker 心跳',
        ok: data.workerHealthy,
        hint: data.workerHealthy ? `${workerModeLabel(data.workerMode)} Worker 正常上报心跳` : 'Worker 心跳已超时，可能未启动或已卡死。',
      },
    ]
  })

  const healthMetaItems = computed<SchedulerFieldItem[]>(() => [
    { key: 'worker-mode', label: 'Worker 模式', value: health.value ? workerModeLabel(health.value.workerMode) : '--' },
    { key: 'heartbeat', label: '最新心跳', value: formatDateTime(health.value?.workerHeartbeat?.lastSeenAt) },
    { key: 'last-task', label: '最后任务', value: health.value?.workerHeartbeat?.lastTaskId || '--' },
    { key: 'last-error', label: '最近错误', value: health.value?.workerHeartbeat?.lastError || '--' },
  ])

  const policyItems = computed<SchedulerPolicyItem[]>(() => {
    const snapshot = health.value?.policySnapshot || {}
    return POLICY_KEYS.map(({ key, envKey }) => {
      const display = getSystemConfigFieldDisplay(envKey)
      return {
        key,
        envKey,
        title: display.title,
        description: display.description,
        value: formatPolicyValue(snapshot[key]),
      }
    })
  })

  const selectedSummaryText = computed(() => {
    if (!selectedTask.value) {
      return '请从下方任务队列中选择一条任务，再进行详情查看、重试、取消或优先级调整。'
    }

    const task = selectedTask.value
    return `${task.stockCode} · ${statusLabel(task.status)} · ${executionModeLabel(task.executionMode)} · 第 ${task.attemptNo} 次执行 · 优先级 ${task.priority} · ${resolveOwnerLabel(task)}`
  })

  const selectedTaskView = computed<SchedulerSelectedTaskView>(() => ({
    summary: selectedSummaryText.value,
    headerTag: selectedTask.value
      ? { key: 'status', label: statusLabel(selectedTask.value.status), type: statusTone(selectedTask.value.status) }
      : null,
    tags: selectedTask.value ? buildTaskTags(selectedTask.value) : [],
    fields: selectedTask.value ? buildTaskMetaFields(selectedTask.value) : [],
    progress: selectedTask.value && (selectedTask.value.status === 'processing' || selectedTask.value.status === 'completed')
      ? progressPercent(selectedTask.value.progress)
      : null,
  }))

  const actionState = computed<SchedulerActionState>(() => ({
    canRetry: canRetry(selectedTask.value),
    canRerun: canRerun(selectedTask.value),
    canCancel: canCancel(selectedTask.value),
    canAdjustPriority: Boolean(isAdmin.value && selectedTask.value?.status === 'pending'),
  }))

  const queueSummary = computed(() => {
    const parts = [`${scopeLabel.value}`, `共 ${total.value} 条`, `本页 ${rows.value.length} 条`]
    if (filters.value.status)
      parts.push(statusLabel(filters.value.status as SchedulerTaskStatus))
    if (filters.value.executionMode)
      parts.push(executionModeLabel(filters.value.executionMode as SchedulerTaskItem['executionMode']))
    if (filters.value.staleOnly)
      parts.push('仅异常')
    return parts.join(' · ')
  })

  const taskCards = computed<SchedulerTaskCardView[]>(() => {
    return rows.value.map(task => ({
      task,
      title: task.stockCode,
      subtitle: task.reportType || 'analysis',
      statusTag: { key: 'status', label: statusLabel(task.status), type: statusTone(task.status) },
      tags: buildTaskTags(task),
      fields: buildQueueFields(task),
      timeline: buildTimelineFields(task),
      message: taskMessage(task),
      messageType: taskMessageTone(task),
      progress: task.status === 'processing' || task.status === 'completed' ? progressPercent(task.progress) : null,
    }))
  })

  const spotlightTaskCards = computed<SchedulerSpotlightTaskItem[]>(() => {
    const spans = [
      { span: 1, sSpan: 2, lSpan: 6 },
      { span: 1, sSpan: 1, lSpan: 3 },
      { span: 1, sSpan: 1, lSpan: 3 },
      { span: 1, sSpan: 2, lSpan: 6 },
    ]

    return taskCards.value.slice(0, 4).map((card, index) => ({
      key: card.task.taskId,
      span: spans[index]?.span ?? 1,
      sSpan: spans[index]?.sSpan ?? 1,
      lSpan: spans[index]?.lSpan ?? 3,
      card,
      selected: selectedTask.value?.taskId === card.task.taskId,
    }))
  })

  const activityItems = computed<SchedulerActivityItem[]>(() => {
    if (selectedTask.value) {
      const task = selectedTask.value
      const items: SchedulerActivityItem[] = [
        {
          key: `${task.taskId}-created`,
          title: '任务提交',
          content: `${resolveOwnerLabel(task)} 提交了 ${task.stockCode} 的 ${task.reportType || 'analysis'} 任务`,
          time: formatDateTime(task.createdAt),
          type: 'info',
        },
      ]

      if (task.startedAt) {
        items.push({
          key: `${task.taskId}-started`,
          title: '开始执行',
          content: `${executionModeLabel(task.executionMode)} 模式已开始处理任务`,
          time: formatDateTime(task.startedAt),
          type: 'warning',
        })
      }

      if (task.completedAt) {
        items.push({
          key: `${task.taskId}-finished`,
          title: task.status === 'completed' ? '执行完成' : task.status === 'cancelled' ? '任务取消' : '执行结束',
          content: taskMessage(task),
          time: formatDateTime(task.completedAt),
          type: timelineType(task.status),
        })
      }
      else if (task.status === 'failed') {
        items.push({
          key: `${task.taskId}-failed`,
          title: '执行失败',
          content: taskMessage(task),
          time: formatDateTime(task.startedAt || task.createdAt),
          type: 'error',
        })
      }

      if (task.isStale) {
        items.push({
          key: `${task.taskId}-stale`,
          title: '异常告警',
          content: '任务处理时长超过阈值，建议优先排查 Worker 心跳和任务链路。',
          time: formatDateTime(task.startedAt || task.createdAt),
          type: 'error',
        })
      }

      return items
    }

    return rows.value.slice(0, 5).map(task => ({
      key: task.taskId,
      title: `${task.stockCode} · ${statusLabel(task.status)}`,
      content: taskMessage(task),
      time: formatDateTime(task.completedAt || task.startedAt || task.createdAt),
      type: timelineType(task.status),
    }))
  })

  const taskTableRows = computed<SchedulerTaskTableRow[]>(() => {
    return rows.value.map(task => ({
      key: task.taskId,
      taskId: task.taskId,
      stockCode: task.stockCode,
      reportType: task.reportType || 'analysis',
      statusTag: { key: 'status', label: statusLabel(task.status), type: statusTone(task.status) },
      executionModeLabel: executionModeLabel(task.executionMode),
      ownerLabel: resolveOwnerLabel(task),
      priority: task.priority,
      progress: task.status === 'processing' || task.status === 'completed' ? progressPercent(task.progress) : null,
      progressLabel: progressLabel(task),
      createdAt: formatDateTime(task.createdAt),
      message: taskMessage(task),
      messageType: taskMessageTone(task),
      selected: selectedTask.value?.taskId === task.taskId,
    }))
  })

  const queuePreviewItems = computed<SchedulerQueuePreviewItem[]>(() => {
    const statusRank: Record<SchedulerTaskStatus, number> = {
      pending: 0,
      processing: 1,
      failed: 2,
      completed: 3,
      cancelled: 4,
    }

    return [...rows.value]
      .sort((left, right) => {
        const statusDiff = statusRank[left.status] - statusRank[right.status]
        if (statusDiff !== 0)
          return statusDiff
        if (left.priority !== right.priority)
          return left.priority - right.priority
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      })
      .slice(0, 4)
      .map(task => ({
        key: task.taskId,
        stockCode: task.stockCode,
        statusTag: { key: 'status', label: statusLabel(task.status), type: statusTone(task.status) },
        priority: task.priority,
        progressLabel: progressLabel(task),
        ownerLabel: resolveOwnerLabel(task),
      }))
  })

  const detailView = computed<SchedulerDetailView | null>(() => {
    if (!detailData.value)
      return null

    const task = detailData.value.task
    const metaItems: SchedulerFieldItem[] = [
      { key: 'owner', label: '提交人', value: resolveOwnerLabel(task) },
      { key: 'createdAt', label: '提交时间', value: formatDateTime(task.createdAt) },
      { key: 'startedAt', label: '开始执行', value: formatDateTime(task.startedAt) },
      { key: 'completedAt', label: '结束执行', value: formatDateTime(task.completedAt) },
      { key: 'rootTaskId', label: 'root_task_id', value: task.rootTaskId || '--' },
      { key: 'retryOfTaskId', label: 'retry_of_task_id', value: task.retryOfTaskId || '--' },
      { key: 'resultQueryId', label: 'result_query_id', value: task.resultQueryId || '--' },
      { key: 'progress', label: '执行进度', value: progressLabel(task) },
    ]

    const chainItems: SchedulerTimelineItem[] = detailData.value.taskChain.map(item => ({
      key: item.taskId,
      title: `${item.stockCode} · 第 ${item.attemptNo} 次 · ${statusLabel(item.status)}`,
      content: item.message || '--',
      time: formatDateTime(item.createdAt),
      type: item.status === 'completed'
        ? 'success'
        : item.status === 'failed'
          ? 'error'
          : item.status === 'processing'
            ? 'info'
            : 'default',
    }))

    return {
      detail: detailData.value,
      title: `调度任务详情 · ${detailData.value.task.stockCode}`,
      summary: `${resolveOwnerLabel(task)} 于 ${formatDateTime(task.createdAt)} 提交了 ${task.stockCode} 的 ${requestedExecutionModeLabel(task.requestedExecutionMode)} 调度任务，当前状态为 ${statusLabel(task.status)}。`,
      headerTag: { key: 'status', label: statusLabel(task.status), type: statusTone(task.status) },
      tags: buildTaskTags(task),
      fields: metaItems,
      progress: task.status === 'processing' || task.status === 'completed' ? progressPercent(task.progress) : null,
      chainItems,
      payloadCards: [
        { key: 'request', title: '请求参数', value: pretty(detailData.value.requestPayload) },
        { key: 'bridge', title: 'Bridge Meta', value: pretty(detailData.value.bridgeMeta) },
        { key: 'auto-order', title: '执行结果', value: pretty(detailData.value.autoOrder) },
        { key: 'result', title: '结果载荷', value: pretty(detailData.value.resultPayload) },
      ],
    }
  })

  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

  function setScope(nextScope: SchedulerScope) {
    scope.value = nextScope
  }

  function setFilters(nextFilters: SchedulerFilterForm) {
    filters.value = nextFilters
  }

  function selectTask(taskId: string) {
    selectedTaskId.value = taskId
  }

  function clearSelection() {
    selectedTaskId.value = null
  }

  async function loadOverview() {
    overviewLoading.value = true
    try {
      overview.value = await getSchedulerOverview(scope.value)
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '加载调度总览失败'))
    }
    finally {
      overviewLoading.value = false
    }
  }

  async function loadHealth() {
    healthLoading.value = true
    try {
      health.value = await getSchedulerHealth()
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '加载调度健康信息失败'))
    }
    finally {
      healthLoading.value = false
    }
  }

  async function loadTasks(reset = false) {
    if (reset)
      page.value = 1

    loading.value = true
    try {
      const result = await listSchedulerTasks({
        page: page.value,
        limit: limit.value,
        status: filters.value.status || undefined,
        stockCode: filters.value.stockCode.trim() || undefined,
        username: isAdmin.value ? (filters.value.username.trim() || undefined) : undefined,
        executionMode: filters.value.executionMode || undefined,
        staleOnly: filters.value.staleOnly,
        startDate: filters.value.dateRange?.[0] ? formatDateParam(filters.value.dateRange[0]) : undefined,
        endDate: filters.value.dateRange?.[1] ? formatDateParam(filters.value.dateRange[1]) : undefined,
        scope: scope.value,
      })

      rows.value = result.items
      total.value = result.total

      if (selectedTaskId.value && !rows.value.some(item => item.taskId === selectedTaskId.value))
        selectedTaskId.value = null
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '加载调度任务失败'))
    }
    finally {
      loading.value = false
    }
  }

  async function refreshAll(reset = false) {
    await Promise.all([
      loadOverview(),
      loadHealth(),
      loadTasks(reset),
    ])
  }

  async function searchTasks() {
    await refreshAll(true)
  }

  async function focusFailedTasks() {
    filters.value = {
      ...filters.value,
      status: 'failed',
      staleOnly: false,
    }
    await refreshAll(true)
  }

  async function focusStaleTasks() {
    filters.value = {
      ...filters.value,
      status: null,
      staleOnly: true,
    }
    await refreshAll(true)
  }

  function resetFilters() {
    filters.value = createDefaultFilters()
    void refreshAll(true)
  }

  async function loadDetailStages(taskId: string) {
    detailStageWarning.value = ''
    try {
      const payload = await getReservedTaskStages(taskId)
      detailStages.value = payload.stages.map(item => ({
        ...item,
        title: stageTitle(item.code),
        summary: item.summary || '阶段执行完成',
      }))
    }
    catch (error: unknown) {
      detailStages.value = []
      detailStageWarning.value = getErrorMessage(error, '加载阶段详情失败')
    }
  }

  async function openDetail(taskId?: string) {
    const targetId = taskId || selectedTask.value?.taskId
    if (!targetId) {
      window.$message.warning('请先选择一条任务')
      return
    }

    detailVisible.value = true
    detailLoading.value = true
    detailData.value = null
    detailStages.value = []
    detailStageWarning.value = ''

    try {
      const result = await getSchedulerTaskDetail(targetId)
      detailData.value = result
      selectedTaskId.value = result.task.taskId
      await loadDetailStages(targetId)
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '加载调度任务详情失败'))
    }
    finally {
      detailLoading.value = false
    }
  }

  async function handleRetry() {
    if (!canRetry(selectedTask.value)) {
      window.$message.warning('仅失败任务允许重试')
      return
    }

    try {
      const result = await retrySchedulerTask(selectedTask.value!.taskId)
      selectedTaskId.value = result.taskId
      window.$message.success('任务已重新加入队列')
      await refreshAll()
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '重试任务失败'))
    }
  }

  async function handleRerun() {
    if (!canRerun(selectedTask.value)) {
      window.$message.warning('仅已完成或失败的任务允许重跑')
      return
    }

    try {
      const result = await rerunSchedulerTask(selectedTask.value!.taskId)
      selectedTaskId.value = result.taskId
      window.$message.success('任务已重新创建并加入队列')
      await refreshAll()
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '重跑任务失败'))
    }
  }

  async function handleCancel() {
    if (!canCancel(selectedTask.value)) {
      window.$message.warning('仅排队中的任务允许取消')
      return
    }

    const currentTaskId = selectedTask.value!.taskId

    try {
      await cancelSchedulerTask(currentTaskId)
      window.$message.success('任务已取消')
      await refreshAll()
      if (detailData.value?.task.taskId === currentTaskId)
        await openDetail(currentTaskId)
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '取消任务失败'))
    }
  }

  function openPriorityModal() {
    if (!actionState.value.canAdjustPriority) {
      window.$message.warning('仅管理员可调整排队中任务的优先级')
      return
    }
    priorityDraft.value = selectedTask.value?.priority ?? 100
    priorityVisible.value = true
  }

  function closePriorityModal() {
    priorityVisible.value = false
  }

  async function submitPriority() {
    if (!selectedTask.value)
      return

    if (!priorityDraft.value || priorityDraft.value < 1 || priorityDraft.value > 9999) {
      window.$message.warning('优先级必须是 1 到 9999 的整数')
      return
    }

    const targetTaskId = selectedTask.value.taskId

    prioritySaving.value = true
    try {
      await updateSchedulerTaskPriority(targetTaskId, priorityDraft.value)
      priorityVisible.value = false
      window.$message.success('任务优先级已更新')
      await refreshAll()
      if (detailVisible.value)
        await openDetail(targetTaskId)
    }
    catch (error: unknown) {
      window.$message.error(getErrorMessage(error, '更新优先级失败'))
    }
    finally {
      prioritySaving.value = false
    }
  }

  async function handlePageChange(nextPage: number) {
    page.value = nextPage
    await loadTasks()
  }

  watch(scope, () => {
    clearSelection()
    void refreshAll(true)
  })

  onMounted(async () => {
    await sessionStore.ensureStatus()
    if (!isAdmin.value)
      scope.value = 'mine'
    await refreshAll(true)
  })

  return {
    actionState,
    detailData,
    detailLoading,
    detailStageWarning,
    detailStages,
    detailView,
    detailVisible,
    executionModeOptions: EXECUTION_MODE_OPTIONS,
    filters,
    focusFailedTasks,
    focusStaleTasks,
    handleCancel,
    handlePageChange,
    handleRerun,
    handleRetry,
    healthItems,
    healthMetaItems,
    healthSummary,
    heroView,
    isAdmin,
    limit,
    loading,
    currentFocusCards,
    openDetail,
    openPriorityModal,
    overviewCards,
    overviewSummaryCards,
    page,
    pageCount,
    policyItems,
    priorityAlerts,
    priorityDraft,
    prioritySaving,
    priorityVisible,
    queueHealthCards,
    queuePreviewItems,
    queueSummary,
    refreshAll,
    resetFilters,
    scope,
    searchTasks,
    selectedTask,
    selectedTaskView,
    selectTask,
    setFilters,
    setScope,
    showPriorityAction: computed(() => isAdmin.value),
    statusOptions: STATUS_OPTIONS,
    submitPriority,
    spotlightTaskCards,
    taskCards,
    taskTableRows,
    total,
    activityItems,
    clearSelection,
    closePriorityModal,
  }
}
