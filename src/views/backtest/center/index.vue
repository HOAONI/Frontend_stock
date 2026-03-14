<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import type { LineSeriesOption } from 'echarts/charts'
import { h, onActivated, onDeactivated } from 'vue'

import { CARD_DENSITY, CHART_HEIGHT, DASHBOARD_LAYOUT, GRID_GAP, SPACING } from '@/constants/design-tokens'
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'
import {
  fetchAgentBacktestHistory,
  fetchAgentBacktestRunDetail,
  runAgentReplayBacktest,
} from '@/services/agent-backtest-service'
import {
  createMyBacktestStrategy,
  deleteMyBacktestStrategy,
  fetchBacktestStrategyTemplates,
  fetchStrategyRunDetail,
  fetchStrategyRunHistory,
  fetchUserBacktestStrategies,
  runStrategyRangeBacktest,
  updateMyBacktestStrategy,
} from '@/services/backtest-strategy-service'
import type {
  AgentBacktestDailyStep,
  AgentBacktestDetailResponse,
  AgentBacktestHistoryItem,
  AgentBacktestLlmMeta,
  AgentBacktestTradeItem,
} from '@/types/agent-backtest'
import type {
  BacktestStrategyTemplate,
  BacktestStrategyTemplateCode,
  StrategyRangeRunResponse,
  StrategyRunHistoryItem,
  StrategyTradeItem,
  UserBacktestStrategyItem,
} from '@/types/backtest-strategy'
import { session } from '@/utils'

type BacktestMode = 'strategy' | 'agent'
type StrategyPendingRequest = App.BacktestCenterStrategyPendingRequest
type AgentPendingRequest = App.BacktestCenterAgentPendingRequest

defineOptions({
  name: 'backtestCenter',
})

const BACKTEST_SESSION_VERSION = 2
const BACKTEST_PENDING_MATCH_TOLERANCE_MS = 2 * 60 * 1000
const STRATEGY_PARAM_LABELS: Record<string, string> = {
  maWindow: 'MA 周期',
  rsiPeriod: 'RSI 周期',
  oversoldThreshold: '超卖阈值',
  overboughtThreshold: '超买阈值',
}
const AGENT_STATUS_LABELS: Record<string, string> = {
  refining: '精修中',
  completed: '已完成',
  failed: '失败',
}
const AGENT_PHASE_LABELS: Record<string, string> = {
  fast: '快速阶段',
  refine: '精修阶段',
  done: '已完成',
}
const AGENT_DECISION_SOURCE_LABELS: Record<string, string> = {
  fast_rule: '快速规则',
}
const AGENT_ACTION_LABELS: Record<string, string> = {
  buy: '买入',
  sell: '卖出',
  hold: '持有',
  none: '无',
}
const AGENT_LLM_PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  siliconflow: 'SiliconFlow',
  custom: '自定义兼容接口',
}

const mode = ref<BacktestMode>('strategy')

const code = ref('')
const dateRange = ref<[number, number] | null>(null)
const initialCapital = ref<number | null>(100000)
const commissionRate = ref<number | null>(0.0003)
const slippageBps = ref<number | null>(2)

const strategyIds = ref<number[]>([])
const strategyTemplates = ref<BacktestStrategyTemplate[]>([])
const userStrategies = ref<UserBacktestStrategyItem[]>([])
const loadingStrategyLibrary = ref(false)
const strategyDrawerVisible = ref(false)
const strategySaving = ref(false)
const strategyDeletingId = ref<number | null>(null)
const strategyFormMode = ref<'create' | 'edit'>('create')
const strategyForm = reactive<{
  id: number | null
  name: string
  description: string
  templateCode: BacktestStrategyTemplateCode
  params: Record<string, number>
}>({
  id: null,
  name: '',
  description: '',
  templateCode: 'ma_cross',
  params: {},
})

const agentPositionMaxPct = ref<number | null>(30)
const agentStopLossPct = ref<number | null>(8)
const agentTakeProfitPct = ref<number | null>(15)
const agentEnableRefine = ref(true)

const running = ref(false)
const loadingDetail = ref(false)
const loadingHistory = ref(false)
const runError = ref('')
const recoveryNotice = ref('')

const currentStrategyRun = ref<StrategyRangeRunResponse | null>(null)
const strategyHistoryRows = ref<StrategyRunHistoryItem[]>([])
const strategyHistoryTotal = ref(0)
const strategyHistoryPage = ref(1)
const strategyHistoryPageSize = ref(8)
const strategyActiveRunGroupId = ref<number | null>(null)
const strategyPendingRequest = ref<StrategyPendingRequest | null>(null)

const currentAgentRun = ref<AgentBacktestDetailResponse | null>(null)
const agentHistoryRows = ref<AgentBacktestHistoryItem[]>([])
const agentHistoryTotal = ref(0)
const agentHistoryPage = ref(1)
const agentHistoryPageSize = ref(8)
const agentActiveRunGroupId = ref<number | null>(null)
const agentPendingRequest = ref<AgentPendingRequest | null>(null)

const equityOptions = ref<ECOption>({})
const hydratingSnapshot = ref(false)
let agentPollTimer: ReturnType<typeof setInterval> | null = null

const strategyOptions = computed(() => {
  return userStrategies.value.map(item => ({
    id: item.id,
    label: item.name,
    description: `${item.templateName} · ${formatStrategyParams(item.params)}`,
  }))
})

const currentStrategyTemplate = computed(() => {
  return strategyTemplates.value.find(item => item.templateCode === strategyForm.templateCode) || null
})

const strategyDrawerTitle = computed(() => {
  return strategyFormMode.value === 'create' ? '新建回测策略' : '编辑回测策略'
})

function normalizeCodeText(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeLookupKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function toDayText(value: number): string {
  const day = new Date(value)
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function metric(value: unknown, digits = 2): string {
  const number = Number(value)
  if (!Number.isFinite(number))
    return '--'
  return `${number.toFixed(digits)}%`
}

function money(value: unknown, digits = 2): string {
  const number = Number(value)
  if (!Number.isFinite(number))
    return '--'
  return number.toFixed(digits)
}

function ratioTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  if (number >= 60)
    return 'success'
  if (number >= 40)
    return 'warning'
  return 'error'
}

function returnTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  if (number > 0)
    return 'success'
  if (number < 0)
    return 'error'
  return 'warning'
}

function drawdownTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  const absValue = Math.abs(number)
  if (absValue <= 10)
    return 'success'
  if (absValue <= 20)
    return 'warning'
  return 'error'
}

function noTradeReasonText(reason: string): string {
  if (reason === 'no_entry_signal')
    return '无入场信号'
  if (reason === 'entry_rejected_margin')
    return '入场被资金约束拒绝'
  if (reason === 'no_exit_signal')
    return '无离场信号（窗口内）'
  if (reason === 'no_completed_trade')
    return '未形成完整交易'
  return ''
}

function formatNoTradeReason(row: any): string {
  const totalTrades = Number(row.totalTrades)
  if (Number.isFinite(totalTrades) && totalTrades > 0)
    return '--'

  const reason = String(row.noTradeReason || '').trim()
  const detail = String(row.noTradeReasonDetail || '').trim()
  const text = noTradeReasonText(reason) || '--'
  if (text === '--')
    return text
  return detail ? `${text} (${detail})` : text
}

function getTemplateDefaults(templateCode: BacktestStrategyTemplateCode): Record<string, number> {
  const template = strategyTemplates.value.find(item => item.templateCode === templateCode)
  return template ? { ...template.defaultParams } : {}
}

function formatStrategyParamLabel(key: string): string {
  return STRATEGY_PARAM_LABELS[key] || key
}

function formatStrategyParams(params: Record<string, unknown>): string {
  return Object.entries(params || {})
    .map(([key, value]) => `${formatStrategyParamLabel(key)}：${value}`)
    .join('，')
}

function formatStrategyUpdatedAt(value: string | null | undefined): string {
  const time = new Date(String(value || ''))
  if (Number.isNaN(time.getTime()))
    return '--'
  return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}

function formatAgentStatus(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '--'
  return AGENT_STATUS_LABELS[normalizeLookupKey(raw)] || raw
}

function formatAgentPhase(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '--'
  return AGENT_PHASE_LABELS[normalizeLookupKey(raw)] || raw
}

function formatAgentStatusPhase(status: unknown, phase: unknown): string {
  const statusLabel = formatAgentStatus(status)
  const phaseLabel = formatAgentPhase(phase)
  if (phaseLabel === '--' || phaseLabel === statusLabel)
    return statusLabel
  return `${statusLabel} / ${phaseLabel}`
}

function agentStatusTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const key = normalizeLookupKey(value)
  if (key === 'completed')
    return 'success'
  if (key === 'failed')
    return 'error'
  if (key === 'refining')
    return 'warning'
  return 'default'
}

function formatDecisionSource(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '--'
  return AGENT_DECISION_SOURCE_LABELS[normalizeLookupKey(raw)] || raw
}

function formatAgentAction(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '--'
  return AGENT_ACTION_LABELS[normalizeLookupKey(raw)] || raw
}

function formatExecutionPayload(payload: Record<string, unknown> | null | undefined): string {
  const action = formatAgentAction(payload?.action ?? 'none')
  const pending = formatAgentAction(payload?.pendingAction ?? payload?.pending_action ?? 'none')
  return `当前：${action} / 下一步：${pending}`
}

function formatAgentLlmProvider(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return '--'
  return AGENT_LLM_PROVIDER_LABELS[normalizeLookupKey(raw)] || raw
}

function formatAgentLlmSource(meta: AgentBacktestLlmMeta | null | undefined): string {
  const source = normalizeLookupKey(meta?.source)
  if (source === 'personal')
    return '个人 AI'
  if (source === 'system')
    return '系统内置 AI'
  return '--'
}

function formatAgentLlmHistorySource(meta: AgentBacktestLlmMeta | null | undefined): string {
  const sourceText = formatAgentLlmSource(meta)
  const providerText = formatAgentLlmProvider(meta?.provider)
  if (sourceText === '--')
    return providerText
  if (providerText === '--')
    return sourceText
  return `${sourceText.replace(' AI', '')} ${providerText}`
}

function formatAgentLlmModel(meta: AgentBacktestLlmMeta | null | undefined): string {
  const providerText = formatAgentLlmProvider(meta?.provider)
  const modelText = String(meta?.model ?? '').trim()
  if (!modelText)
    return providerText
  if (providerText === '--')
    return modelText
  return `${providerText} / ${modelText}`
}

function formatDecisionSourceBreakdown(value: Record<string, unknown> | null | undefined): string {
  const entries = Object.entries(value || {})
  if (entries.length === 0)
    return '--'
  return entries
    .map(([key, count]) => `${formatDecisionSource(key)}：${count}`)
    .join('，')
}

function normalizeStrategySelection(values: number[]): number[] {
  const allowedIds = new Set(userStrategies.value.map(item => item.id))
  return Array.from(new Set(values.map(item => Math.trunc(Number(item)))))
    .filter(item => Number.isFinite(item) && item > 0 && allowedIds.has(item))
}

function sameStrategyIds(left: number[], right: number[]): boolean {
  const normalizedLeft = [...new Set(left)].sort((a, b) => a - b)
  const normalizedRight = [...new Set(right)].sort((a, b) => a - b)
  if (normalizedLeft.length !== normalizedRight.length)
    return false
  return normalizedLeft.every((item, index) => item === normalizedRight[index])
}

function openStrategyDrawer(mode: 'create' | 'edit', strategy?: UserBacktestStrategyItem) {
  strategyFormMode.value = mode
  strategyDrawerVisible.value = true

  if (strategy) {
    strategyForm.id = strategy.id
    strategyForm.name = strategy.name
    strategyForm.description = strategy.description || ''
    strategyForm.templateCode = strategy.templateCode
    strategyForm.params = { ...strategy.params }
    return
  }

  const fallbackTemplate = strategyTemplates.value[0]?.templateCode || 'ma_cross'
  strategyForm.id = null
  strategyForm.name = ''
  strategyForm.description = ''
  strategyForm.templateCode = fallbackTemplate
  strategyForm.params = getTemplateDefaults(fallbackTemplate)
}

function applyStrategyTemplate(templateCode: BacktestStrategyTemplateCode) {
  strategyForm.templateCode = templateCode
  strategyForm.params = getTemplateDefaults(templateCode)
}

function handleStrategyTemplateChange(value: string) {
  applyStrategyTemplate(value as BacktestStrategyTemplateCode)
}

function handleStrategyParamChange(key: string, value: number | null) {
  const fallback = currentStrategyTemplate.value?.defaultParams[key] ?? 0
  strategyForm.params[key] = Number(value ?? fallback)
}

async function loadStrategyLibrary(options: { silent?: boolean } = {}) {
  loadingStrategyLibrary.value = true
  try {
    const [templateData, strategyData] = await Promise.all([
      fetchBacktestStrategyTemplates(),
      fetchUserBacktestStrategies(),
    ])
    strategyTemplates.value = templateData.items
    userStrategies.value = strategyData.items
    if (strategyTemplates.value.length > 0 && !strategyTemplates.value.some(item => item.templateCode === strategyForm.templateCode))
      strategyForm.templateCode = strategyTemplates.value[0].templateCode
    strategyIds.value = normalizeStrategySelection(strategyIds.value)
    if (!strategyDrawerVisible.value && strategyTemplates.value.length > 0 && !strategyForm.id)
      strategyForm.params = getTemplateDefaults(strategyForm.templateCode)
  }
  catch (error: unknown) {
    if (!options.silent) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载用户策略失败'
      window.$message.error(message)
      runError.value = message
    }
  }
  finally {
    loadingStrategyLibrary.value = false
  }
}

async function saveStrategyForm() {
  const template = currentStrategyTemplate.value
  if (!template) {
    window.$message.warning('策略模板尚未加载完成')
    return
  }
  if (!strategyForm.name.trim()) {
    window.$message.warning('请输入策略名称')
    return
  }

  strategySaving.value = true
  try {
    const params = template.paramSchema.reduce<Record<string, number>>((acc, field) => {
      const raw = Number(strategyForm.params[field.key] ?? template.defaultParams[field.key])
      acc[field.key] = Number.isFinite(raw) ? raw : template.defaultParams[field.key]
      return acc
    }, {})

    const payload = {
      name: strategyForm.name.trim(),
      description: strategyForm.description.trim() || undefined,
      templateCode: strategyForm.templateCode,
      params,
    }

    const saved = strategyFormMode.value === 'create' || !strategyForm.id
      ? await createMyBacktestStrategy(payload)
      : await updateMyBacktestStrategy(strategyForm.id, payload)

    await loadStrategyLibrary({ silent: true })
    strategyIds.value = normalizeStrategySelection([...strategyIds.value, saved.id])
    strategyDrawerVisible.value = false
    window.$message.success(strategyFormMode.value === 'create' ? '策略已创建' : '策略已更新')
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存策略失败'
    window.$message.error(message)
  }
  finally {
    strategySaving.value = false
  }
}

function confirmDeleteStrategy(strategy: UserBacktestStrategyItem) {
  window.$dialog.warning({
    title: '删除策略',
    content: `确认删除策略“${strategy.name}”？删除后历史回测仍保留快照，但该策略将不能再被选择。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      strategyDeletingId.value = strategy.id
      try {
        await deleteMyBacktestStrategy(strategy.id)
        strategyIds.value = normalizeStrategySelection(strategyIds.value.filter(item => item !== strategy.id))
        if (strategyForm.id === strategy.id)
          openStrategyDrawer('create')
        await loadStrategyLibrary({ silent: true })
        window.$message.success('策略已删除')
      }
      catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除策略失败'
        window.$message.error(message)
      }
      finally {
        strategyDeletingId.value = null
      }
    },
  })
}

function normalizeDateRangeSnapshot(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2)
    return null
  const start = Number(value[0])
  const end = Number(value[1])
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return null
  return [start, end]
}

function normalizePage(value: unknown, fallback = 1): number {
  const page = Math.trunc(Number(value))
  return Number.isFinite(page) && page > 0 ? page : fallback
}

function normalizeRunGroupId(value: unknown): number | null {
  const runGroupId = Math.trunc(Number(value))
  return Number.isFinite(runGroupId) && runGroupId > 0 ? runGroupId : null
}

function sameRequestedRange(range: { startDate: string | null, endDate: string | null }, startDate: string, endDate: string): boolean {
  return String(range.startDate || '') === startDate && String(range.endDate || '') === endDate
}

function isPendingCreatedAtMatch(createdAt: string | null | undefined, startedAt: string): boolean {
  const createdMs = new Date(String(createdAt || '')).getTime()
  const startedMs = new Date(startedAt).getTime()
  if (!Number.isFinite(createdMs) || !Number.isFinite(startedMs))
    return false
  return createdMs >= startedMs - BACKTEST_PENDING_MATCH_TOLERANCE_MS
}

function buildBacktestSnapshot(): App.BacktestCenterSessionState {
  return {
    version: BACKTEST_SESSION_VERSION,
    mode: mode.value,
    code: code.value,
    dateRange: dateRange.value ? [...dateRange.value] as [number, number] : null,
    initialCapital: initialCapital.value ?? null,
    commissionRate: commissionRate.value ?? null,
    slippageBps: slippageBps.value ?? null,
    strategy: {
      strategyIds: [...normalizeStrategySelection(strategyIds.value)],
      historyPage: strategyHistoryPage.value,
      activeRunGroupId: strategyActiveRunGroupId.value,
      pendingRequestSignature: strategyPendingRequest.value,
    },
    agent: {
      positionMaxPct: agentPositionMaxPct.value ?? null,
      stopLossPct: agentStopLossPct.value ?? null,
      takeProfitPct: agentTakeProfitPct.value ?? null,
      enableRefine: agentEnableRefine.value,
      historyPage: agentHistoryPage.value,
      activeRunGroupId: agentActiveRunGroupId.value,
      pendingRequestSignature: agentPendingRequest.value,
    },
  }
}

function persistBacktestSnapshot() {
  if (hydratingSnapshot.value)
    return
  session.set('backtestCenter', buildBacktestSnapshot())
}

function readBacktestSnapshot(): App.BacktestCenterSessionState | null {
  const snapshot = session.get('backtestCenter')
  if (!snapshot || typeof snapshot !== 'object')
    return null
  if (Number((snapshot as App.BacktestCenterSessionState).version ?? 0) !== BACKTEST_SESSION_VERSION)
    return null
  return snapshot as App.BacktestCenterSessionState
}

async function applyBacktestSnapshot(snapshot: App.BacktestCenterSessionState) {
  hydratingSnapshot.value = true
  mode.value = snapshot.mode === 'agent' ? 'agent' : 'strategy'
  code.value = String(snapshot.code || '')
  dateRange.value = normalizeDateRangeSnapshot(snapshot.dateRange)
  initialCapital.value = snapshot.initialCapital ?? null
  commissionRate.value = snapshot.commissionRate ?? null
  slippageBps.value = snapshot.slippageBps ?? null

  strategyIds.value = normalizeStrategySelection((snapshot.strategy?.strategyIds || []) as number[])
  strategyHistoryPage.value = normalizePage(snapshot.strategy?.historyPage, 1)
  strategyActiveRunGroupId.value = normalizeRunGroupId(snapshot.strategy?.activeRunGroupId)
  strategyPendingRequest.value = snapshot.strategy?.pendingRequestSignature?.mode === 'strategy'
    ? snapshot.strategy.pendingRequestSignature
    : null

  agentPositionMaxPct.value = snapshot.agent?.positionMaxPct ?? 30
  agentStopLossPct.value = snapshot.agent?.stopLossPct ?? 8
  agentTakeProfitPct.value = snapshot.agent?.takeProfitPct ?? 15
  agentEnableRefine.value = Boolean(snapshot.agent?.enableRefine ?? true)
  agentHistoryPage.value = normalizePage(snapshot.agent?.historyPage, 1)
  agentActiveRunGroupId.value = normalizeRunGroupId(snapshot.agent?.activeRunGroupId)
  agentPendingRequest.value = snapshot.agent?.pendingRequestSignature?.mode === 'agent'
    ? snapshot.agent.pendingRequestSignature
    : null

  recoveryNotice.value = ''
  runError.value = ''
  await nextTick()
  hydratingSnapshot.value = false
}

function buildStrategyPendingRequest(): StrategyPendingRequest {
  const normalizedStrategyIds = normalizeStrategySelection(strategyIds.value)
  strategyIds.value = normalizedStrategyIds
  return {
    mode: 'strategy',
    code: normalizeCodeText(code.value),
    startDate: toDayText(dateRange.value![0]),
    endDate: toDayText(dateRange.value![1]),
    strategyIds: [...normalizedStrategyIds],
    initialCapital: initialCapital.value ?? null,
    commissionRate: commissionRate.value ?? null,
    slippageBps: slippageBps.value ?? null,
    startedAt: new Date().toISOString(),
  }
}

function buildAgentPendingRequest(): AgentPendingRequest {
  return {
    mode: 'agent',
    code: normalizeCodeText(code.value),
    startDate: toDayText(dateRange.value![0]),
    endDate: toDayText(dateRange.value![1]),
    initialCapital: initialCapital.value ?? null,
    commissionRate: commissionRate.value ?? null,
    slippageBps: slippageBps.value ?? null,
    positionMaxPct: agentPositionMaxPct.value ?? null,
    stopLossPct: agentStopLossPct.value ?? null,
    takeProfitPct: agentTakeProfitPct.value ?? null,
    enableRefine: agentEnableRefine.value,
    startedAt: new Date().toISOString(),
  }
}

function clearCurrentDisplay() {
  stopAgentPolling()
  runError.value = ''
  recoveryNotice.value = ''
  currentStrategyRun.value = null
  currentAgentRun.value = null
  equityOptions.value = {}
}

function rebuildStrategyEquityChart(run: StrategyRangeRunResponse | null) {
  if (!run || run.items.length === 0 || !run.items.some(item => item.equity.length > 0)) {
    equityOptions.value = {}
    return
  }

  const labels = Array.from(new Set(run.items.flatMap(item => item.equity.map(point => point.tradeDate || ''))))
    .filter(item => item.length > 0)
    .sort((a, b) => a.localeCompare(b))
  if (labels.length === 0) {
    equityOptions.value = {}
    return
  }

  const series: LineSeriesOption[] = run.items.map((item) => {
    const map = new Map(item.equity.map(point => [point.tradeDate || '', Number(point.equity)]))
    return {
      name: item.strategyName,
      type: 'line',
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      data: labels.map((label) => {
        const value = map.get(label)
        return Number.isFinite(value) ? value : null
      }),
    }
  })

  const benchmarkMap = new Map<string, number>()
  run.items.forEach((item) => {
    item.equity.forEach((point) => {
      if (point.tradeDate && Number.isFinite(Number(point.benchmarkEquity)) && !benchmarkMap.has(point.tradeDate))
        benchmarkMap.set(point.tradeDate, Number(point.benchmarkEquity))
    })
  })

  if (benchmarkMap.size > 0) {
    series.push({
      name: '基准',
      type: 'line',
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      lineStyle: { type: 'dashed' },
      data: labels.map(label => (benchmarkMap.has(label) ? benchmarkMap.get(label) ?? null : null)),
    })
  }

  equityOptions.value = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: '净值',
      scale: true,
    },
    grid: { left: 50, right: 20, top: 36, bottom: 28 },
    series,
  }
}

function rebuildAgentEquityChart(run: AgentBacktestDetailResponse | null) {
  if (!run || !Array.isArray(run.equity) || run.equity.length === 0) {
    equityOptions.value = {}
    return
  }

  const labels = run.equity
    .map(point => point.tradeDate || '')
    .filter(item => item.length > 0)
  if (labels.length === 0) {
    equityOptions.value = {}
    return
  }

  equityOptions.value = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: '净值',
      scale: true,
    },
    grid: { left: 50, right: 20, top: 36, bottom: 28 },
    series: [
      {
        name: 'Agent 回放',
        type: 'line',
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        data: run.equity.map(point => Number(point.equity)),
      },
      {
        name: '基准',
        type: 'line',
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        lineStyle: { type: 'dashed' },
        data: run.equity.map(point => (Number.isFinite(Number(point.benchmarkEquity)) ? Number(point.benchmarkEquity) : null)),
      },
    ],
  }
}

function rebuildEquityChart() {
  if (mode.value === 'strategy')
    rebuildStrategyEquityChart(currentStrategyRun.value)
  else
    rebuildAgentEquityChart(currentAgentRun.value)
}

const hasEquityData = computed(() => {
  if (mode.value === 'strategy') {
    const run = currentStrategyRun.value
    return Boolean(run && run.items.some(item => item.equity.length > 0))
  }

  const run = currentAgentRun.value
  return Boolean(run && Array.isArray(run.equity) && run.equity.length > 0)
})

const strategyMetricsRows = computed(() => {
  const run = currentStrategyRun.value
  if (!run)
    return []
  return run.items.map((item) => {
    const metrics = item.metrics || {}
    return {
      runId: item.runId,
      strategyId: item.strategyId,
      strategyCode: item.strategyCode,
      strategyName: item.strategyName,
      templateName: item.templateName,
      totalReturnPct: Number(metrics.totalReturnPct ?? metrics.total_return_pct),
      benchmarkReturnPct: Number(metrics.benchmarkReturnPct ?? metrics.benchmark_return_pct),
      excessReturnPct: Number(metrics.excessReturnPct ?? metrics.excess_return_pct),
      maxDrawdownPct: Number(metrics.maxDrawdownPct ?? metrics.max_drawdown_pct),
      totalTrades: Number(metrics.totalTrades ?? metrics.total_trades),
      winRatePct: Number(metrics.winRatePct ?? metrics.win_rate_pct),
      sharpeRatio: Number(metrics.sharpeRatio ?? metrics.sharpe_ratio),
      noTradeReason: String(metrics.noTradeReason ?? metrics.no_trade_reason ?? ''),
      noTradeReasonDetail: String(metrics.noTradeReasonDetail ?? metrics.no_trade_reason_detail ?? ''),
    }
  })
})

const strategyTradeRows = computed(() => {
  const run = currentStrategyRun.value
  if (!run)
    return []

  const rows: Array<StrategyTradeItem & { strategyName: string }> = []
  run.items.forEach((item) => {
    item.trades.forEach((trade) => {
      rows.push({
        strategyName: item.strategyName,
        ...trade,
      })
    })
  })

  rows.sort((a, b) => String(a.entryDate || '').localeCompare(String(b.entryDate || '')))
  return rows
})

const strategyNoTradeSummary = computed(() => {
  const run = currentStrategyRun.value
  if (!run)
    return ''

  return run.items.map((item) => {
    const metrics = item.metrics || {}
    const totalTrades = Number(metrics.totalTrades ?? metrics.total_trades)
    if (Number.isFinite(totalTrades) && totalTrades > 0)
      return ''

    const reason = String(metrics.noTradeReason ?? metrics.no_trade_reason ?? '').trim()
    const detail = String(metrics.noTradeReasonDetail ?? metrics.no_trade_reason_detail ?? '').trim()
    const text = noTradeReasonText(reason)
    if (!text)
      return ''
    return `${item.strategyName}: ${detail ? `${text} (${detail})` : text}`
  }).filter(item => item.length > 0).join('；')
})

const agentSummary = computed(() => currentAgentRun.value?.summary || {})
const agentDiagnostics = computed(() => currentAgentRun.value?.diagnostics || {})
const agentTradeRows = computed<AgentBacktestTradeItem[]>(() => currentAgentRun.value?.trades || [])
const agentTimelineRows = computed<AgentBacktestDailyStep[]>(() => currentAgentRun.value?.dailySteps || [])
const currentAgentLlmMeta = computed<AgentBacktestLlmMeta | null>(() => currentAgentRun.value?.llmMeta || null)

function stopAgentPolling() {
  if (agentPollTimer) {
    clearInterval(agentPollTimer)
    agentPollTimer = null
  }
}

function ensureAgentPolling(runGroupId: number) {
  stopAgentPolling()
  agentPollTimer = setInterval(async () => {
    try {
      const detail = await fetchAgentBacktestRunDetail(runGroupId)
      currentAgentRun.value = detail
      rebuildEquityChart()
      if (detail.status === 'completed' || detail.status === 'failed') {
        stopAgentPolling()
        if (mode.value === 'agent')
          await loadAgentHistory(agentHistoryPage.value)
      }
    }
    catch {
      stopAgentPolling()
    }
  }, 5000)
}

async function loadStrategyHistory(page = strategyHistoryPage.value, options: { silent?: boolean } = {}) {
  loadingHistory.value = true
  try {
    const data = await fetchStrategyRunHistory({
      page,
      limit: strategyHistoryPageSize.value,
    })
    strategyHistoryRows.value = data.items
    strategyHistoryTotal.value = data.total
    strategyHistoryPage.value = data.page
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || '加载历史策略回测失败（回测存储未就绪或服务异常）'
    if (!options.silent)
      runError.value = message
    strategyHistoryRows.value = []
    strategyHistoryTotal.value = 0
    if (!options.silent)
      window.$message.error(message)
  }
  finally {
    loadingHistory.value = false
  }
}

async function loadAgentHistory(page = agentHistoryPage.value, options: { silent?: boolean } = {}) {
  loadingHistory.value = true
  try {
    const data = await fetchAgentBacktestHistory({
      page,
      limit: agentHistoryPageSize.value,
    })
    agentHistoryRows.value = data.items
    agentHistoryTotal.value = data.total
    agentHistoryPage.value = data.page
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || '加载 Agent 回测历史失败'
    if (!options.silent)
      runError.value = message
    agentHistoryRows.value = []
    agentHistoryTotal.value = 0
    if (!options.silent)
      window.$message.error(message)
  }
  finally {
    loadingHistory.value = false
  }
}

async function loadHistory(page = 1, options: { silent?: boolean } = {}) {
  if (mode.value === 'strategy')
    await loadStrategyHistory(page, options)
  else
    await loadAgentHistory(page, options)
}

async function loadStrategyDetail(runGroupId: number, options: { silent?: boolean, keepPending?: boolean } = {}) {
  loadingDetail.value = true
  if (!options.silent)
    runError.value = ''
  try {
    const detail = await fetchStrategyRunDetail(runGroupId)
    currentStrategyRun.value = detail
    strategyActiveRunGroupId.value = detail.runGroupId
    if (!options.keepPending)
      strategyPendingRequest.value = null
    recoveryNotice.value = ''
    if (mode.value === 'strategy')
      rebuildEquityChart()
    persistBacktestSnapshot()
  }
  catch (error: unknown) {
    if (!options.silent)
      runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载回测详情失败'
  }
  finally {
    loadingDetail.value = false
  }
}

async function loadAgentDetail(runGroupId: number, options: { silent?: boolean, keepPending?: boolean } = {}) {
  loadingDetail.value = true
  if (!options.silent)
    runError.value = ''
  try {
    const detail = await fetchAgentBacktestRunDetail(runGroupId)
    currentAgentRun.value = detail
    agentActiveRunGroupId.value = detail.runGroupId
    if (!options.keepPending)
      agentPendingRequest.value = null
    recoveryNotice.value = ''
    if (mode.value === 'agent')
      rebuildEquityChart()
    if (detail.status === 'refining')
      ensureAgentPolling(runGroupId)
    else
      stopAgentPolling()
    persistBacktestSnapshot()
  }
  catch (error: unknown) {
    if (!options.silent)
      runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载 Agent 回测详情失败'
  }
  finally {
    loadingDetail.value = false
  }
}

async function loadDetail(runGroupId: number) {
  if (mode.value === 'strategy')
    await loadStrategyDetail(runGroupId)
  else
    await loadAgentDetail(runGroupId)
}

async function restoreStrategyPendingRun(showNotice = true): Promise<boolean> {
  const pending = strategyPendingRequest.value
  if (!pending)
    return false

  try {
    const history = await fetchStrategyRunHistory({
      code: pending.code,
      startDate: pending.startDate,
      endDate: pending.endDate,
      page: 1,
      limit: 20,
    })
    const match = history.items.find(item =>
      normalizeCodeText(item.code) === pending.code
      && sameRequestedRange(item.requestedRange, pending.startDate, pending.endDate)
      && sameStrategyIds(item.strategies.map(entry => Number(entry.strategyId)).filter(item => Number.isFinite(item) && item > 0), pending.strategyIds)
      && isPendingCreatedAtMatch(item.createdAt, pending.startedAt),
    )

    if (!match) {
      if (showNotice)
        recoveryNotice.value = '上次回测结果未匹配到，请刷新历史查看'
      return false
    }

    strategyActiveRunGroupId.value = match.runGroupId
    await loadStrategyDetail(match.runGroupId, { silent: true })
    return currentStrategyRun.value?.runGroupId === match.runGroupId
  }
  catch {
    if (showNotice)
      recoveryNotice.value = '上次回测结果未匹配到，请刷新历史查看'
    return false
  }
}

async function restoreAgentPendingRun(showNotice = true): Promise<boolean> {
  const pending = agentPendingRequest.value
  if (!pending)
    return false

  try {
    const history = await fetchAgentBacktestHistory({
      code: pending.code,
      startDate: pending.startDate,
      endDate: pending.endDate,
      page: 1,
      limit: 20,
    })
    const match = history.items.find(item =>
      normalizeCodeText(item.code) === pending.code
      && sameRequestedRange(item.requestedRange, pending.startDate, pending.endDate)
      && isPendingCreatedAtMatch(item.createdAt, pending.startedAt),
    )

    if (!match) {
      if (showNotice)
        recoveryNotice.value = '上次回测结果未匹配到，请刷新历史查看'
      return false
    }

    agentActiveRunGroupId.value = match.runGroupId
    await loadAgentDetail(match.runGroupId, { silent: true })
    return currentAgentRun.value?.runGroupId === match.runGroupId
  }
  catch {
    if (showNotice)
      recoveryNotice.value = '上次回测结果未匹配到，请刷新历史查看'
    return false
  }
}

async function restoreActiveRunForMode(targetMode: BacktestMode): Promise<boolean> {
  if (targetMode === 'strategy') {
    const runGroupId = strategyActiveRunGroupId.value
    if (!runGroupId)
      return false
    if (currentStrategyRun.value?.runGroupId === runGroupId) {
      if (mode.value === 'strategy')
        rebuildEquityChart()
      return true
    }
    await loadStrategyDetail(runGroupId, { silent: true, keepPending: true })
    return currentStrategyRun.value?.runGroupId === runGroupId
  }

  const runGroupId = agentActiveRunGroupId.value
  if (!runGroupId)
    return false
  if (currentAgentRun.value?.runGroupId === runGroupId) {
    if (mode.value === 'agent')
      rebuildEquityChart()
    if (currentAgentRun.value.status === 'refining')
      ensureAgentPolling(runGroupId)
    return true
  }
  await loadAgentDetail(runGroupId, { silent: true, keepPending: true })
  return currentAgentRun.value?.runGroupId === runGroupId
}

async function restoreCurrentModeState(showNotice = false): Promise<boolean> {
  recoveryNotice.value = ''
  if (await restoreActiveRunForMode(mode.value))
    return true

  if (mode.value === 'strategy')
    return await restoreStrategyPendingRun(showNotice)

  return await restoreAgentPendingRun(showNotice)
}

async function hydrateBacktestCenter() {
  await loadStrategyLibrary({ silent: true })
  const snapshot = readBacktestSnapshot()
  if (!snapshot) {
    await loadHistory(1, { silent: true })
    persistBacktestSnapshot()
    return
  }

  await applyBacktestSnapshot(snapshot)
  const historyPage = mode.value === 'strategy' ? strategyHistoryPage.value : agentHistoryPage.value
  await loadHistory(historyPage)
  await restoreCurrentModeState(true)
  rebuildEquityChart()
  persistBacktestSnapshot()
}

async function runStrategyAction() {
  const selectedStrategyIds = normalizeStrategySelection(strategyIds.value)
  if (selectedStrategyIds.length === 0) {
    window.$message.warning('请至少选择一个策略')
    return
  }

  const response = await runStrategyRangeBacktest({
    code: code.value.trim(),
    startDate: toDayText(dateRange.value![0]),
    endDate: toDayText(dateRange.value![1]),
    strategyIds: selectedStrategyIds,
    initialCapital: initialCapital.value ?? undefined,
    commissionRate: commissionRate.value ?? undefined,
    slippageBps: slippageBps.value ?? undefined,
  })

  currentStrategyRun.value = response.data
  strategyActiveRunGroupId.value = response.data.runGroupId
  strategyPendingRequest.value = null
  recoveryNotice.value = ''
  rebuildEquityChart()
  await loadStrategyHistory(1)

  if (strategyNoTradeSummary.value)
    window.$message.warning(`策略回测完成：当前区间无成交信号。${strategyNoTradeSummary.value}`)
  else
    window.$message.success('策略回测完成')
}

async function runAgentAction() {
  const response = await runAgentReplayBacktest({
    code: code.value.trim(),
    startDate: toDayText(dateRange.value![0]),
    endDate: toDayText(dateRange.value![1]),
    initialCapital: initialCapital.value ?? undefined,
    commissionRate: commissionRate.value ?? undefined,
    slippageBps: slippageBps.value ?? undefined,
    runtimeStrategy: {
      positionMaxPct: agentPositionMaxPct.value ?? undefined,
      stopLossPct: agentStopLossPct.value ?? undefined,
      takeProfitPct: agentTakeProfitPct.value ?? undefined,
    },
    enableRefine: agentEnableRefine.value,
  })

  currentAgentRun.value = response.data
  agentActiveRunGroupId.value = response.data.runGroupId
  agentPendingRequest.value = null
  recoveryNotice.value = ''
  rebuildEquityChart()
  await loadAgentHistory(1)

  if (response.data.status === 'refining') {
    ensureAgentPolling(response.data.runGroupId)
    window.$message.warning('Agent 回放回测快速阶段已完成，正在进入精修阶段')
  }
  else {
    stopAgentPolling()
    window.$message.success('Agent 回放回测完成')
  }
}

async function runBacktest() {
  runError.value = ''
  if (!code.value.trim()) {
    window.$message.warning('请输入股票代码')
    return
  }
  if (!dateRange.value || dateRange.value.length !== 2) {
    window.$message.warning('请选择日期区间')
    return
  }
  if (mode.value === 'strategy' && normalizeStrategySelection(strategyIds.value).length === 0) {
    window.$message.warning('请至少选择一个已保存策略')
    return
  }

  running.value = true
  try {
    recoveryNotice.value = ''
    clearCurrentDisplay()
    if (mode.value === 'strategy') {
      strategyActiveRunGroupId.value = null
      strategyPendingRequest.value = buildStrategyPendingRequest()
    }
    else {
      agentActiveRunGroupId.value = null
      agentPendingRequest.value = buildAgentPendingRequest()
    }
    persistBacktestSnapshot()
    if (mode.value === 'strategy')
      await runStrategyAction()
    else
      await runAgentAction()
  }
  catch (error: unknown) {
    runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (mode.value === 'strategy' ? '策略回测失败' : 'Agent 回放回测失败')
  }
  finally {
    running.value = false
  }
}

const strategyMetricsColumns = [
  { title: '策略', key: 'strategyName' },
  {
    title: '总收益',
    key: 'totalReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.totalReturnPct) }, { default: () => metric(row.totalReturnPct, 2) }),
  },
  {
    title: '基准收益',
    key: 'benchmarkReturnPct',
    render: (row: any) => metric(row.benchmarkReturnPct, 2),
  },
  {
    title: '超额收益',
    key: 'excessReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.excessReturnPct) }, { default: () => metric(row.excessReturnPct, 2) }),
  },
  {
    title: '最大回撤',
    key: 'maxDrawdownPct',
    render: (row: any) => h(NTag, { size: 'small', type: drawdownTagType(row.maxDrawdownPct) }, { default: () => metric(Math.abs(Number(row.maxDrawdownPct || 0)), 2) }),
  },
  { title: '交易数', key: 'totalTrades' },
  {
    title: '无交易原因',
    key: 'noTradeReason',
    render: (row: any) => formatNoTradeReason(row),
  },
  {
    title: '胜率',
    key: 'winRatePct',
    render: (row: any) => h(NTag, { size: 'small', type: ratioTagType(row.winRatePct) }, { default: () => metric(row.winRatePct, 2) }),
  },
  {
    title: '夏普比率',
    key: 'sharpeRatio',
    render: (row: any) => {
      const value = Number(row.sharpeRatio)
      return Number.isFinite(value) ? value.toFixed(3) : '--'
    },
  },
]

const strategyTradeColumns = [
  { title: '策略', key: 'strategyName' },
  { title: '开仓日', key: 'entryDate' },
  { title: '平仓日', key: 'exitDate' },
  {
    title: '开仓价',
    key: 'entryPrice',
    render: (row: any) => money(row.entryPrice, 4),
  },
  {
    title: '平仓价',
    key: 'exitPrice',
    render: (row: any) => money(row.exitPrice, 4),
  },
  { title: '数量', key: 'qty' },
  {
    title: '净收益',
    key: 'netReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.netReturnPct) }, { default: () => metric(row.netReturnPct, 2) }),
  },
  {
    title: '手续费',
    key: 'fees',
    render: (row: any) => money(row.fees, 6),
  },
  { title: '离场原因', key: 'exitReason' },
]

const strategyHistoryColumns = [
  { title: '回测批次', key: 'runGroupId' },
  { title: '代码', key: 'code' },
  {
    title: '请求区间',
    key: 'requestedRange',
    render: (row: StrategyRunHistoryItem) => `${row.requestedRange.startDate || '--'} ~ ${row.requestedRange.endDate || '--'}`,
  },
  {
    title: '有效区间',
    key: 'effectiveRange',
    render: (row: StrategyRunHistoryItem) => `${row.effectiveRange.startDate || '--'} ~ ${row.effectiveRange.endDate || '--'}`,
  },
  {
    title: '策略',
    key: 'strategies',
    render: (row: StrategyRunHistoryItem) => row.strategies.map(item => item.strategyName).join(', '),
  },
  { title: '创建时间', key: 'createdAt' },
  {
    title: '操作',
    key: 'actions',
    render: (row: StrategyRunHistoryItem) => h(
      NButton,
      {
        size: 'small',
        tertiary: true,
        onClick: () => loadDetail(row.runGroupId),
      },
      { default: () => '查看' },
    ),
  },
]

const agentTradeColumns = [
  { title: '开仓日', key: 'entryDate' },
  { title: '平仓日', key: 'exitDate' },
  {
    title: '开仓价',
    key: 'entryPrice',
    render: (row: any) => money(row.entryPrice, 4),
  },
  {
    title: '平仓价',
    key: 'exitPrice',
    render: (row: any) => money(row.exitPrice, 4),
  },
  { title: '数量', key: 'qty' },
  {
    title: '净收益',
    key: 'netReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.netReturnPct) }, { default: () => metric(row.netReturnPct, 2) }),
  },
  { title: '离场原因', key: 'exitReason' },
]

const agentTimelineColumns = [
  { title: '日期', key: 'tradeDate' },
  {
    title: '信号来源',
    key: 'decisionSource',
    render: (row: AgentBacktestDailyStep) => h(NTag, { size: 'small', type: row.aiUsed ? 'warning' : 'info' }, { default: () => formatDecisionSource(row.decisionSource) }),
  },
  {
    title: '操作建议',
    key: 'signalPayload',
    render: (row: AgentBacktestDailyStep) => String(row.signalPayload?.operationAdvice || '--'),
  },
  {
    title: '风控目标',
    key: 'riskPayload',
    render: (row: AgentBacktestDailyStep) => {
      const value = Number(row.riskPayload?.targetWeight)
      return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '--'
    },
  },
  {
    title: '执行',
    key: 'executionPayload',
    render: (row: AgentBacktestDailyStep) => formatExecutionPayload(row.executionPayload),
  },
]

const agentHistoryColumns = [
  { title: '回测批次', key: 'runGroupId' },
  { title: '代码', key: 'code' },
  {
    title: '请求区间',
    key: 'requestedRange',
    render: (row: AgentBacktestHistoryItem) => `${row.requestedRange.startDate || '--'} ~ ${row.requestedRange.endDate || '--'}`,
  },
  {
    title: '状态',
    key: 'status',
    render: (row: AgentBacktestHistoryItem) => h(
      NTag,
      { size: 'small', type: agentStatusTagType(row.status) },
      { default: () => formatAgentStatusPhase(row.status, row.phase) },
    ),
  },
  {
    title: 'AI 来源',
    key: 'llmMeta',
    render: (row: AgentBacktestHistoryItem) => h(
      NTag,
      {
        size: 'small',
        type: normalizeLookupKey(row.llmMeta?.source) === 'personal' ? 'success' : 'info',
      },
      { default: () => formatAgentLlmHistorySource(row.llmMeta) },
    ),
  },
  {
    title: '收益',
    key: 'summary',
    render: (row: AgentBacktestHistoryItem) => metric(row.summary?.totalReturnPct ?? row.summary?.total_return_pct, 2),
  },
  { title: '创建时间', key: 'createdAt' },
  {
    title: '操作',
    key: 'actions',
    render: (row: AgentBacktestHistoryItem) => h(
      NButton,
      {
        size: 'small',
        tertiary: true,
        onClick: () => loadDetail(row.runGroupId),
      },
      { default: () => '查看' },
    ),
  },
]

useEcharts('backtestEquityRef', equityOptions)

watch(mode, async () => {
  if (hydratingSnapshot.value)
    return
  stopAgentPolling()
  clearCurrentDisplay()
  const page = mode.value === 'strategy' ? strategyHistoryPage.value : agentHistoryPage.value
  await loadHistory(page)
  await restoreCurrentModeState(false)
  persistBacktestSnapshot()
})

watch([
  mode,
  code,
  dateRange,
  initialCapital,
  commissionRate,
  slippageBps,
  strategyIds,
  agentPositionMaxPct,
  agentStopLossPct,
  agentTakeProfitPct,
  agentEnableRefine,
  strategyHistoryPage,
  agentHistoryPage,
  strategyActiveRunGroupId,
  agentActiveRunGroupId,
  strategyPendingRequest,
  agentPendingRequest,
], () => {
  persistBacktestSnapshot()
}, { deep: true })

onMounted(async () => {
  await hydrateBacktestCenter()
})

onActivated(async () => {
  await restoreCurrentModeState(false)
})

onDeactivated(() => {
  stopAgentPolling()
  persistBacktestSnapshot()
})

onBeforeUnmount(() => {
  stopAgentPolling()
  persistBacktestSnapshot()
})
</script>

<template>
  <n-space vertical :size="SPACING.md">
    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24">
        <n-card title="回测中心" :size="CARD_DENSITY.default">
          <n-space vertical :size="SPACING.md">
            <n-space :size="SPACING.sm" align="center">
              <span>回测模式</span>
              <n-radio-group v-model:value="mode" name="backtest-mode">
                <n-radio-button value="strategy">
                  策略回测
                </n-radio-button>
                <n-radio-button value="agent">
                  Agent 回放
                </n-radio-button>
              </n-radio-group>
            </n-space>

            <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
              <n-grid-item :span="24" :m-span="12" :l-span="6">
                <n-input v-model:value="code" placeholder="股票代码（必填）" clearable />
              </n-grid-item>
              <n-grid-item :span="24" :m-span="12" :l-span="10">
                <n-date-picker
                  v-model:value="dateRange"
                  type="daterange"
                  clearable
                  class="w-full"
                  :is-date-disabled="() => false"
                />
              </n-grid-item>

              <template v-if="mode === 'strategy'">
                <n-grid-item :span="24" :m-span="24" :l-span="8">
                  <n-space vertical :size="SPACING.sm" class="w-full">
                    <n-space justify="space-between" align="center" class="w-full">
                      <span>我的回测策略</span>
                      <n-space :size="SPACING.sm">
                        <NButton tertiary size="small" @click="openStrategyDrawer('create')">
                          新建策略
                        </NButton>
                        <NButton tertiary size="small" @click="openStrategyDrawer('create')">
                          管理策略
                        </NButton>
                      </n-space>
                    </n-space>

                    <n-empty v-if="!loadingStrategyLibrary && strategyOptions.length === 0" size="small" description="暂无已保存策略">
                      <template #extra>
                        <NButton size="small" type="primary" @click="openStrategyDrawer('create')">
                          从模板创建
                        </NButton>
                      </template>
                    </n-empty>

                    <n-checkbox-group v-else v-model:value="strategyIds">
                      <n-space vertical :size="SPACING.xs" class="w-full">
                        <div
                          v-for="item in strategyOptions"
                          :key="item.id"
                          class="rounded-3 border border-solid border-#e5e7eb px-3 py-2"
                        >
                          <n-space vertical :size="SPACING.xs">
                            <n-checkbox :value="item.id">
                              {{ item.label }}
                            </n-checkbox>
                            <n-text depth="3" class="text-12px">
                              {{ item.description }}
                            </n-text>
                          </n-space>
                        </div>
                      </n-space>
                    </n-checkbox-group>
                  </n-space>
                </n-grid-item>
              </template>
              <template v-else>
                <n-grid-item :span="24" :m-span="12" :l-span="8">
                  <n-space align="center" justify="space-between" class="w-full">
                    <span>启用精修</span>
                    <n-switch v-model:value="agentEnableRefine" />
                  </n-space>
                </n-grid-item>
              </template>

              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="initialCapital" :min="1" clearable>
                  <template #prefix>
                    初始资金
                  </template>
                </n-input-number>
              </n-grid-item>
              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="commissionRate" :min="0" :max="1" :step="0.0001" clearable>
                  <template #prefix>
                    佣金率
                  </template>
                </n-input-number>
              </n-grid-item>
              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="slippageBps" :min="0" :max="1000" :step="0.5" clearable>
                  <template #prefix>
                    滑点(bps)
                  </template>
                </n-input-number>
              </n-grid-item>

              <template v-if="mode === 'agent'">
                <n-grid-item :span="24" :m-span="8" :l-span="8">
                  <n-input-number v-model:value="agentPositionMaxPct" :min="0" :max="100" clearable>
                    <template #prefix>
                      最大仓位(%)
                    </template>
                  </n-input-number>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="8" :l-span="8">
                  <n-input-number v-model:value="agentStopLossPct" :min="0" :max="100" clearable>
                    <template #prefix>
                      止损(%)
                    </template>
                  </n-input-number>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="8" :l-span="8">
                  <n-input-number v-model:value="agentTakeProfitPct" :min="0" :max="500" clearable>
                    <template #prefix>
                      止盈(%)
                    </template>
                  </n-input-number>
                </n-grid-item>
              </template>
            </n-grid>

            <n-space :size="SPACING.sm" :wrap="true">
              <NButton type="primary" :loading="running" @click="runBacktest">
                {{ mode === 'strategy' ? '运行策略回测' : '运行 Agent 回放' }}
              </NButton>
              <NButton v-if="mode === 'strategy'" secondary @click="openStrategyDrawer('create')">
                管理我的策略
              </NButton>
              <NButton secondary :loading="loadingHistory" @click="loadHistory(mode === 'strategy' ? strategyHistoryPage : agentHistoryPage)">
                刷新历史
              </NButton>
            </n-space>

            <n-alert v-if="mode === 'strategy'" type="info" :show-icon="false">
              当前模式支持选择你自己创建并保存的模板化回测策略。
            </n-alert>
            <n-alert v-else type="info" :show-icon="false">
              当前模式为 Agent 回放回测，按交易日回放 <code>数据 → 信号 → 风控 → 执行</code>。
            </n-alert>
            <n-alert v-if="mode === 'agent' && currentAgentRun?.status === 'refining'" type="warning" :show-icon="false">
              精修中：当前展示快速阶段结果，系统会每 5 秒自动刷新。
            </n-alert>
            <n-alert v-if="recoveryNotice" type="warning" :show-icon="false">
              {{ recoveryNotice }}
            </n-alert>
            <n-alert v-if="runError" type="error" :show-icon="false">
              {{ runError }}
            </n-alert>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <n-card :title="mode === 'strategy' ? '运行摘要' : '回放摘要'" :size="CARD_DENSITY.default">
          <template v-if="mode === 'strategy'">
            <n-empty v-if="!currentStrategyRun" description="暂无回测结果" />
            <n-space v-else vertical :size="SPACING.sm">
              <n-descriptions bordered :column="1" size="small" label-placement="left">
                <n-descriptions-item label="回测批次">
                  <NTag size="small" type="info">
                    {{ currentStrategyRun.runGroupId }}
                  </NTag>
                </n-descriptions-item>
                <n-descriptions-item label="代码">
                  {{ currentStrategyRun.code }}
                </n-descriptions-item>
                <n-descriptions-item label="请求区间">
                  {{ currentStrategyRun.requestedRange.startDate }} ~ {{ currentStrategyRun.requestedRange.endDate }}
                </n-descriptions-item>
                <n-descriptions-item label="有效交易区间">
                  {{ currentStrategyRun.effectiveRange.startDate }} ~ {{ currentStrategyRun.effectiveRange.endDate }}
                </n-descriptions-item>
                <n-descriptions-item label="引擎版本">
                  {{ currentStrategyRun.engineVersion }}
                </n-descriptions-item>
                <n-descriptions-item label="策略数量">
                  {{ currentStrategyRun.items.length }}
                </n-descriptions-item>
              </n-descriptions>
              <n-alert v-if="strategyNoTradeSummary" type="warning" :show-icon="false">
                运行成功，当前区间无成交，原因：{{ strategyNoTradeSummary }}
              </n-alert>
            </n-space>
          </template>

          <template v-else>
            <n-empty v-if="!currentAgentRun" description="暂无回放结果" />
            <n-space v-else vertical :size="SPACING.sm">
              <n-descriptions bordered :column="1" size="small" label-placement="left">
                <n-descriptions-item label="回测批次">
                  <NTag size="small" :type="agentStatusTagType(currentAgentRun.status)">
                    {{ currentAgentRun.runGroupId }}
                  </NTag>
                </n-descriptions-item>
                <n-descriptions-item label="状态">
                  {{ formatAgentStatusPhase(currentAgentRun.status, currentAgentRun.phase) }}
                </n-descriptions-item>
                <n-descriptions-item label="代码">
                  {{ currentAgentRun.code }}
                </n-descriptions-item>
                <n-descriptions-item label="请求区间">
                  {{ currentAgentRun.requestedRange.startDate }} ~ {{ currentAgentRun.requestedRange.endDate }}
                </n-descriptions-item>
                <n-descriptions-item label="有效区间">
                  {{ currentAgentRun.effectiveRange.startDate }} ~ {{ currentAgentRun.effectiveRange.endDate }}
                </n-descriptions-item>
                <n-descriptions-item label="AI 来源">
                  {{ formatAgentLlmSource(currentAgentLlmMeta) }}
                </n-descriptions-item>
                <n-descriptions-item label="AI 模型">
                  {{ formatAgentLlmModel(currentAgentLlmMeta) }}
                </n-descriptions-item>
                <n-descriptions-item label="总收益">
                  <NTag size="small" :type="returnTagType(agentSummary.totalReturnPct ?? agentSummary.total_return_pct)">
                    {{ metric(agentSummary.totalReturnPct ?? agentSummary.total_return_pct, 2) }}
                  </NTag>
                </n-descriptions-item>
                <n-descriptions-item label="最大回撤">
                  <NTag size="small" :type="drawdownTagType(agentSummary.maxDrawdownPct ?? agentSummary.max_drawdown_pct)">
                    {{ metric(agentSummary.maxDrawdownPct ?? agentSummary.max_drawdown_pct, 2) }}
                  </NTag>
                </n-descriptions-item>
                <n-descriptions-item label="胜率">
                  <NTag size="small" :type="ratioTagType(agentSummary.winRatePct ?? agentSummary.win_rate_pct)">
                    {{ metric(agentSummary.winRatePct ?? agentSummary.win_rate_pct, 2) }}
                  </NTag>
                </n-descriptions-item>
                <n-descriptions-item label="锚点数 / 缓存命中率">
                  {{ agentSummary.llmAnchorCount ?? agentSummary.llm_anchor_count ?? 0 }} / {{ metric(agentSummary.snapshotHitRate ?? agentSummary.snapshot_hit_rate, 2) }}
                </n-descriptions-item>
              </n-descriptions>
            </n-space>
          </template>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="12">
        <n-card :title="mode === 'strategy' ? '净值曲线' : '回放净值曲线'" :size="CARD_DENSITY.default">
          <n-spin :show="loadingDetail || running">
            <n-empty v-if="!hasEquityData" description="暂无可绘制曲线" />
            <div v-else ref="backtestEquityRef" :style="{ width: '100%', height: `${CHART_HEIGHT.compactDesktop}px` }" />
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>

    <template v-if="mode === 'strategy'">
      <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
        <n-grid-item :span="24" :l-span="12">
          <n-card title="策略指标对比" :size="CARD_DENSITY.default">
            <n-data-table
              size="small"
              :columns="strategyMetricsColumns"
              :data="strategyMetricsRows"
              :row-key="(row: any) => row.runId"
            />
          </n-card>
        </n-grid-item>

        <n-grid-item :span="24" :l-span="12">
          <n-card title="交易明细" :size="CARD_DENSITY.default">
            <n-data-table
              size="small"
              :columns="strategyTradeColumns"
              :data="strategyTradeRows"
              :row-key="(row: any) => `${row.strategyName}-${row.entryDate || ''}-${row.exitDate || ''}-${row.qty || ''}-${row.entryPrice || ''}`"
            />
          </n-card>
        </n-grid-item>
      </n-grid>
    </template>

    <template v-else>
      <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
        <n-grid-item :span="24" :l-span="12">
          <n-card title="交易明细" :size="CARD_DENSITY.default">
            <n-data-table
              size="small"
              :columns="agentTradeColumns"
              :data="agentTradeRows"
              :row-key="(row: AgentBacktestTradeItem) => `${row.entryDate || ''}-${row.exitDate || ''}-${row.qty || ''}-${row.entryPrice || ''}`"
            />
          </n-card>
        </n-grid-item>

        <n-grid-item :span="24" :l-span="12">
          <n-card title="日度时间线" :size="CARD_DENSITY.default">
            <n-data-table
              size="small"
              :columns="agentTimelineColumns"
              :data="agentTimelineRows"
              :pagination="{ pageSize: 8 }"
              :row-key="(row: AgentBacktestDailyStep) => row.tradeDate || ''"
            />
          </n-card>
        </n-grid-item>
      </n-grid>

      <n-card title="诊断信息" :size="CARD_DENSITY.default">
        <n-empty v-if="!currentAgentRun" description="暂无诊断信息" />
        <n-descriptions v-else bordered :column="2" size="small" label-placement="left">
          <n-descriptions-item label="无新闻降级天数">
            {{ agentDiagnostics.noNewsDays ?? agentDiagnostics.no_news_days ?? 0 }}
          </n-descriptions-item>
          <n-descriptions-item label="快速阶段/精修阶段分歧天数">
            {{ agentDiagnostics.fastRefinedDivergenceDays ?? agentDiagnostics.fast_refined_divergence_days ?? 0 }}
          </n-descriptions-item>
          <n-descriptions-item label="缓存命中">
            {{ agentDiagnostics.snapshotHitCount ?? agentDiagnostics.snapshot_hit_count ?? 0 }}
          </n-descriptions-item>
          <n-descriptions-item label="缓存未命中">
            {{ agentDiagnostics.snapshotMissCount ?? agentDiagnostics.snapshot_miss_count ?? 0 }}
          </n-descriptions-item>
          <n-descriptions-item label="决策来源分布">
            {{ formatDecisionSourceBreakdown(currentAgentRun.decisionSourceBreakdown || {}) }}
          </n-descriptions-item>
          <n-descriptions-item label="待精修锚点">
            {{
              (
                Array.isArray(agentDiagnostics.pendingAnchorDates)
                  ? agentDiagnostics.pendingAnchorDates
                  : Array.isArray(agentDiagnostics.pending_anchor_dates)
                    ? agentDiagnostics.pending_anchor_dates
                    : []
              ).join(', ') || '--'
            }}
          </n-descriptions-item>
        </n-descriptions>
      </n-card>
    </template>

    <n-card :title="mode === 'strategy' ? '历史策略回测记录' : '历史 Agent 回放记录'" :size="CARD_DENSITY.default">
      <n-space vertical :size="SPACING.sm">
        <n-data-table
          size="small"
          :loading="loadingHistory"
          :columns="mode === 'strategy' ? strategyHistoryColumns : agentHistoryColumns"
          :data="mode === 'strategy' ? strategyHistoryRows : agentHistoryRows"
          :row-key="(row: any) => row.runGroupId"
        />
        <n-pagination
          :page="mode === 'strategy' ? strategyHistoryPage : agentHistoryPage"
          :item-count="mode === 'strategy' ? strategyHistoryTotal : agentHistoryTotal"
          :page-size="mode === 'strategy' ? strategyHistoryPageSize : agentHistoryPageSize"
          @update:page="(value) => {
            if (mode === 'strategy')
              strategyHistoryPage = value
            else
              agentHistoryPage = value
            loadHistory(value)
          }"
        />
      </n-space>
    </n-card>

    <n-drawer v-model:show="strategyDrawerVisible" :width="560">
      <n-drawer-content :title="strategyDrawerTitle" closable>
        <n-space vertical :size="SPACING.md">
          <n-card size="small" title="策略表单">
            <n-space vertical :size="SPACING.sm">
              <n-input v-model:value="strategyForm.name" maxlength="64" show-count placeholder="策略名称" />
              <n-input
                v-model:value="strategyForm.description"
                type="textarea"
                maxlength="255"
                show-count
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="策略说明（可选）"
              />
              <n-select
                :value="strategyForm.templateCode"
                :options="strategyTemplates.map(item => ({ label: item.templateName, value: item.templateCode }))"
                @update:value="handleStrategyTemplateChange"
              />

              <template v-if="currentStrategyTemplate">
                <n-text depth="3" class="text-12px">
                  {{ currentStrategyTemplate.description }}
                </n-text>
                <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
                  <n-grid-item
                    v-for="field in currentStrategyTemplate.paramSchema"
                    :key="field.key"
                    :span="24"
                    :m-span="12"
                  >
                    <n-input-number
                      :value="strategyForm.params[field.key]"
                      :min="field.min"
                      :max="field.max"
                      :step="field.step"
                      clearable
                      class="w-full"
                      @update:value="(value) => handleStrategyParamChange(field.key, value)"
                    >
                      <template #prefix>
                        {{ field.label }}
                      </template>
                    </n-input-number>
                    <n-text depth="3" class="mt-1 block text-12px">
                      {{ field.description }} ({{ field.min }} - {{ field.max }})
                    </n-text>
                  </n-grid-item>
                </n-grid>
              </template>

              <n-space justify="end">
                <NButton @click="openStrategyDrawer('create')">
                  重置
                </NButton>
                <NButton type="primary" :loading="strategySaving" @click="saveStrategyForm">
                  {{ strategyFormMode === 'create' ? '创建策略' : '保存修改' }}
                </NButton>
              </n-space>
            </n-space>
          </n-card>

          <n-card size="small" title="已保存策略">
            <n-space vertical :size="SPACING.sm">
              <n-empty v-if="userStrategies.length === 0" description="还没有自建策略" />
              <template v-else>
                <n-card
                  v-for="item in userStrategies"
                  :key="item.id"
                  size="small"
                  embedded
                >
                  <n-space vertical :size="SPACING.xs">
                    <n-space justify="space-between" align="center">
                      <n-space align="center">
                        <NTag size="small" type="info">
                          {{ item.templateName }}
                        </NTag>
                        <strong>{{ item.name }}</strong>
                      </n-space>
                      <n-space :size="SPACING.sm">
                        <NButton size="small" tertiary @click="openStrategyDrawer('edit', item)">
                          编辑
                        </NButton>
                        <NButton
                          size="small"
                          tertiary
                          type="error"
                          :loading="strategyDeletingId === item.id"
                          @click="confirmDeleteStrategy(item)"
                        >
                          删除
                        </NButton>
                      </n-space>
                    </n-space>
                    <n-text v-if="item.description" depth="2">
                      {{ item.description }}
                    </n-text>
                    <n-text depth="3" class="text-12px">
                      参数: {{ formatStrategyParams(item.params) || '--' }}
                    </n-text>
                    <n-text depth="3" class="text-12px">
                      更新时间: {{ formatStrategyUpdatedAt(item.updatedAt) }}
                    </n-text>
                  </n-space>
                </n-card>
              </template>
            </n-space>
          </n-card>
        </n-space>
      </n-drawer-content>
    </n-drawer>
  </n-space>
</template>
