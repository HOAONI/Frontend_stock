<script setup lang="ts">
import { deleteAgentChatSession, getAgentChatSession, listAgentChatSessions, streamAgentChat } from '@/api/agent-chat'
import type {
  AgentChatDoneResponse,
  AgentChatExecutionResult,
  AgentChatExecutionSessionGuard,
  AgentChatMessage,
  AgentChatSessionItem,
  AgentChatStreamEvent,
} from '@/types/agent-chat'
import { renderSimpleMarkdown } from '@/utils/simple-markdown'
import { formatDateTime } from '@/utils/stock'

interface StreamProgressItem {
  key: string
  event: AgentChatStreamEvent['event']
  summary: string
}

interface DecisionPanelStreamItem {
  key: string
  kind: 'plan' | 'stage' | 'warning'
  stage: string
  stockCode: string
  summary: string
  confidence: number | null
  warnings: string[]
}

interface StreamingAssistantState {
  content: string
  createdAt: string
  started: boolean
}

const route = useRoute()

const sessions = ref<AgentChatSessionItem[]>([])
const activeSessionId = ref('')
const messages = ref<AgentChatMessage[]>([])
const draft = ref('')
const loadingSessions = ref(false)
const loadingDetail = ref(false)
const sending = ref(false)
const streamEvents = ref<StreamProgressItem[]>([])
const decisionEvents = ref<DecisionPanelStreamItem[]>([])
const waitingForFirstEvent = ref(false)
const sessionsLoadError = ref('')
const sessionPage = ref(1)
const messageScrollRef = ref<HTMLElement | null>(null)
const streamingAssistant = reactive<StreamingAssistantState>({
  content: '',
  createdAt: '',
  started: false,
})

const SESSION_PAGE_SIZE = 2

let firstEventTimer: number | null = null

const queryStockCode = computed(() => String(route.query.stockCode || '').trim())
const totalSessionPages = computed(() => Math.max(1, Math.ceil(sessions.value.length / SESSION_PAGE_SIZE)))
const visibleSessions = computed(() => {
  const start = (sessionPage.value - 1) * SESSION_PAGE_SIZE
  return sessions.value.slice(start, start + SESSION_PAGE_SIZE)
})

function makeStreamKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildQueryPrompt() {
  if (!queryStockCode.value)
    return ''
  return `帮我分析一下今天的 ${queryStockCode.value} 行情`
}

function moveSessionPageToSession(sessionId: string) {
  if (!sessionId)
    return
  const index = sessions.value.findIndex(item => item.sessionId === sessionId)
  if (index < 0)
    return
  sessionPage.value = Math.floor(index / SESSION_PAGE_SIZE) + 1
}

function startNewSession(resetDraft = true) {
  activeSessionId.value = ''
  messages.value = []
  streamEvents.value = []
  decisionEvents.value = []
  resetStreamingAssistant()
  waitingForFirstEvent.value = false
  sessionPage.value = 1
  if (resetDraft)
    draft.value = buildQueryPrompt()
}

function clearFirstEventTimer() {
  if (firstEventTimer != null) {
    window.clearTimeout(firstEventTimer)
    firstEventTimer = null
  }
}

function scheduleFirstEventHint() {
  clearFirstEventTimer()
  waitingForFirstEvent.value = false
  firstEventTimer = window.setTimeout(() => {
    if (sending.value && streamEvents.value.length === 0)
      waitingForFirstEvent.value = true
  }, 8000)
}

async function loadSessions(autoOpenFirst = false) {
  loadingSessions.value = true
  sessionsLoadError.value = ''
  try {
    const result = await listAgentChatSessions(50)
    sessions.value = result.items
    if (activeSessionId.value)
      moveSessionPageToSession(activeSessionId.value)
    else
      sessionPage.value = Math.min(sessionPage.value, totalSessionPages.value)
    if (autoOpenFirst && !activeSessionId.value && sessions.value.length > 0)
      await openSession(sessions.value[0].sessionId)
  }
  catch (error: unknown) {
    const message = (error as Error)?.message || '加载会话列表失败'
    sessionsLoadError.value = message
    window.$message.error(message)
  }
  finally {
    loadingSessions.value = false
  }
}

async function openSession(sessionId: string) {
  if (!sessionId)
    return
  loadingDetail.value = true
  try {
    const detail = await getAgentChatSession(sessionId)
    activeSessionId.value = detail.sessionId
    moveSessionPageToSession(detail.sessionId)
    messages.value = detail.messages || []
    streamEvents.value = []
    decisionEvents.value = []
    resetStreamingAssistant()
  }
  catch (error: unknown) {
    window.$message.error((error as Error)?.message || '加载会话详情失败')
  }
  finally {
    loadingDetail.value = false
  }
}

async function recoverLatestSessionAfterFailure() {
  try {
    await loadSessions(false)
    const latestSessionId = sessions.value[0]?.sessionId || activeSessionId.value
    if (latestSessionId)
      await openSession(latestSessionId)
  }
  catch {
    // Keep the original error toast as the primary signal.
  }
}

function confirmRemoveSession() {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (confirmed: boolean) => {
      if (settled)
        return
      settled = true
      resolve(confirmed)
    }

    window.$dialog.warning({
      title: '删除会话',
      content: '确认删除该会话吗？',
      positiveText: '删除',
      negativeText: '取消',
      autoFocus: false,
      onPositiveClick: () => finish(true),
      onNegativeClick: () => finish(false),
      onClose: () => finish(false),
    })
  })
}

async function removeSession(sessionId: string) {
  if (!await confirmRemoveSession())
    return
  try {
    await deleteAgentChatSession(sessionId)
    if (activeSessionId.value === sessionId)
      startNewSession(false)
    await loadSessions(false)
  }
  catch (error: unknown) {
    window.$message.error((error as Error)?.message || '删除会话失败')
  }
}

function eventLabel(event: AgentChatStreamEvent['event']) {
  if (event === 'thinking')
    return '思考中'
  if (event === 'tool_start')
    return '工具开始'
  if (event === 'tool_done')
    return '工具完成'
  if (event === 'supervisor_plan')
    return '主控计划'
  if (event === 'stage_update')
    return '阶段更新'
  if (event === 'warning')
    return '警告'
  if (event === 'message_start' || event === 'message_delta')
    return '回答生成'
  if (event === 'done')
    return '完成'
  return '错误'
}

function eventTagType(event: AgentChatStreamEvent['event']): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (event === 'thinking')
    return 'info'
  if (event === 'tool_start')
    return 'warning'
  if (event === 'supervisor_plan')
    return 'info'
  if (event === 'stage_update')
    return 'success'
  if (event === 'message_start' || event === 'message_delta')
    return 'info'
  if (event === 'warning')
    return 'warning'
  if (event === 'tool_done' || event === 'done')
    return 'success'
  return 'error'
}

function stageLabel(stage: string) {
  if (stage === 'controller')
    return '主控'
  if (stage === 'data')
    return '数据'
  if (stage === 'signal')
    return '信号'
  if (stage === 'risk')
    return '风控'
  if (stage === 'execution')
    return '执行'
  return stage || '阶段'
}

function decisionTagType(kind: DecisionPanelStreamItem['kind']): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (kind === 'plan')
    return 'info'
  if (kind === 'warning')
    return 'warning'
  return 'success'
}

function toWarningList(value: unknown): string[] {
  if (typeof value === 'string')
    return value.trim() ? [value.trim()] : []
  if (!Array.isArray(value))
    return []
  return value
    .map((item) => {
      if (typeof item === 'string')
        return item.trim()
      if (item && typeof item === 'object' && 'message' in item)
        return String((item as { message?: unknown }).message || '').trim()
      return String(item || '').trim()
    })
    .filter(Boolean)
}

function pushStreamEvent(event: AgentChatStreamEvent) {
  const data = event.data as Record<string, unknown>
  const summary = String(data.summary || data.message || eventLabel(event.event))
  waitingForFirstEvent.value = false
  clearFirstEventTimer()
  streamEvents.value.push({
    key: makeStreamKey(),
    event: event.event,
    summary,
  })
}

function resetStreamingAssistant() {
  streamingAssistant.content = ''
  streamingAssistant.createdAt = ''
  streamingAssistant.started = false
}

function primeStreamingAssistant() {
  streamingAssistant.content = ''
  streamingAssistant.createdAt = new Date().toISOString()
  streamingAssistant.started = false
}

function scrollMessageViewportToBottom() {
  void nextTick(() => {
    const viewport = messageScrollRef.value
    if (!viewport)
      return
    viewport.scrollTop = viewport.scrollHeight
  })
}

function applyStreamingAssistantEvent(event: AgentChatStreamEvent) {
  const data = event.data as Record<string, unknown>
  waitingForFirstEvent.value = false
  clearFirstEventTimer()

  if (!streamingAssistant.createdAt)
    streamingAssistant.createdAt = new Date().toISOString()

  if (event.event === 'message_start') {
    streamingAssistant.started = true
    const content = String(data.content || '')
    if (content)
      streamingAssistant.content = content
    scrollMessageViewportToBottom()
    return
  }

  if (event.event !== 'message_delta')
    return

  streamingAssistant.started = true
  const delta = String(data.delta || '')
  if (delta) {
    streamingAssistant.content += delta
  }
  else {
    const content = String(data.content || '')
    if (content)
      streamingAssistant.content = content
  }
  scrollMessageViewportToBottom()
}

function pushDecisionEvent(event: AgentChatStreamEvent) {
  const data = event.data as Record<string, unknown>
  if (event.event === 'supervisor_plan') {
    decisionEvents.value.push({
      key: makeStreamKey(),
      kind: 'plan',
      stage: 'controller',
      stockCode: '',
      summary: String(data.goal || `主控已生成 ${Array.isArray(data.stagePriority) ? data.stagePriority.join(' -> ') : 'data -> signal -> risk -> execution'} 计划`),
      confidence: null,
      warnings: [],
    })
    return
  }

  if (event.event === 'warning') {
    const message = String(data.message || '阶段警告')
    decisionEvents.value.push({
      key: makeStreamKey(),
      kind: 'warning',
      stage: String(data.stage || ''),
      stockCode: String(data.stockCode || ''),
      summary: message,
      confidence: null,
      warnings: [message],
    })
    return
  }

  if (event.event !== 'stage_update')
    return

  const confidenceRaw = data.confidence
  const confidence = typeof confidenceRaw === 'number'
    ? confidenceRaw
    : typeof confidenceRaw === 'string' && confidenceRaw.trim()
      ? Number(confidenceRaw)
      : null

  decisionEvents.value.push({
    key: makeStreamKey(),
    kind: 'stage',
    stage: String(data.stage || ''),
    stockCode: String(data.stockCode || ''),
    summary: String(data.summary || '阶段完成'),
    confidence: Number.isFinite(confidence as number) ? confidence : null,
    warnings: toWarningList(data.warnings),
  })
}

function asDoneMeta(message: AgentChatMessage): AgentChatDoneResponse | null {
  const meta = message.meta as AgentChatDoneResponse | null | undefined
  if (!meta || typeof meta !== 'object')
    return null
  if (!meta.sessionId || !meta.status)
    return null
  return meta
}

function extractCandidateOrders(meta: AgentChatDoneResponse | null): Array<Record<string, unknown>> {
  return Array.isArray(meta?.candidateOrders) ? meta!.candidateOrders : []
}

function extractAnalysisStocks(meta: AgentChatDoneResponse | null): Array<Record<string, unknown>> {
  const structuredResult = meta?.structuredResult
  if (!structuredResult || typeof structuredResult !== 'object')
    return []
  const analysis = (structuredResult as Record<string, unknown>).analysis
  if (!analysis || typeof analysis !== 'object')
    return []
  const stocks = (analysis as Record<string, unknown>).stocks
  return Array.isArray(stocks) ? stocks.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>> : []
}

function extractExecution(meta: AgentChatDoneResponse | null): AgentChatExecutionResult | null {
  if (!meta?.executionResult || typeof meta.executionResult !== 'object')
    return null
  return meta.executionResult as AgentChatExecutionResult
}

function extractStructuredResult(meta: AgentChatDoneResponse | null): Record<string, unknown> | null {
  if (!meta?.structuredResult || typeof meta.structuredResult !== 'object')
    return null
  return meta.structuredResult as Record<string, unknown>
}

function extractControllerPlan(meta: AgentChatDoneResponse | null): Record<string, unknown> | null {
  const structuredResult = extractStructuredResult(meta)
  const plan = structuredResult?.controllerPlan
  return plan && typeof plan === 'object' ? plan as Record<string, unknown> : null
}

function extractDecisionPanel(meta: AgentChatDoneResponse | null): Array<Record<string, unknown>> {
  const structuredResult = extractStructuredResult(meta)
  const panel = structuredResult?.decisionPanel
  return Array.isArray(panel) ? panel.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>> : []
}

function extractStageTraces(meta: AgentChatDoneResponse | null): Array<Record<string, unknown>> {
  const structuredResult = extractStructuredResult(meta)
  const traces = structuredResult?.stageTraces
  return Array.isArray(traces) ? traces.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>> : []
}

function renderControllerPlanStagePriority(meta: AgentChatDoneResponse | null) {
  const plan = extractControllerPlan(meta)
  const stagePriority = Array.isArray(plan?.stagePriority)
    ? plan.stagePriority.map(item => String(item || '').trim()).filter(Boolean)
    : []
  return stagePriority.length > 0 ? stagePriority.join(' -> ') : 'data -> signal -> risk -> execution'
}

function formatConfidence(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number))
    return '--'
  return `${Math.round(number * 100)}%`
}

function isOutsideTradingSessionExecution(execution: AgentChatExecutionResult | null) {
  return String(execution?.reason || '').trim() === 'outside_trading_session'
}

function extractExecutionSessionGuard(execution: AgentChatExecutionResult | null): AgentChatExecutionSessionGuard | null {
  if (!execution?.sessionGuard || typeof execution.sessionGuard !== 'object')
    return null
  return execution.sessionGuard as AgentChatExecutionSessionGuard
}

function renderSessionLabels(sessionGuard: AgentChatExecutionSessionGuard | null) {
  if (!Array.isArray(sessionGuard?.sessions) || sessionGuard.sessions.length === 0)
    return '--'
  return sessionGuard.sessions.map(item => String(item || '').trim()).filter(Boolean).join('、') || '--'
}

function extractExecutionMessage(execution: AgentChatExecutionResult | null) {
  const message = String(execution?.message || '').trim()
  if (message)
    return message
  if (isOutsideTradingSessionExecution(execution))
    return '当前处于非交易时段，本轮未执行模拟盘订单，候选单已保留。'
  return ''
}

function renderExecutionSummary(execution: AgentChatExecutionResult | null) {
  if (!execution)
    return '--'
  if (isOutsideTradingSessionExecution(execution))
    return '非交易时段未执行'
  if (String(execution.mode || '') === 'batch') {
    return `尝试 ${execution.candidateOrderCount || '--'} 笔，成功 ${execution.executedCount || 0} 笔`
  }
  return `状态 ${String(execution.status || '--')}`
}

function renderMessageHtml(content: string) {
  return renderSimpleMarkdown(content)
}

function renderStreamingAssistantHtml() {
  if (!streamingAssistant.content.trim())
    return renderSimpleMarkdown('正在生成回答...')
  return renderMessageHtml(streamingAssistant.content)
}

function buildUserMessage(content: string): AgentChatMessage {
  return {
    id: Date.now(),
    sessionId: activeSessionId.value || 'pending',
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  }
}

async function submitMessage() {
  const content = draft.value.trim()
  if (!content || sending.value)
    return

  const context: Record<string, unknown> = {
    stock_code: queryStockCode.value || undefined,
    source_path: route.fullPath,
  }

  messages.value = [...messages.value, buildUserMessage(content)]
  draft.value = ''
  sending.value = true
  streamEvents.value = []
  decisionEvents.value = []
  primeStreamingAssistant()
  scheduleFirstEventHint()
  scrollMessageViewportToBottom()

  try {
    const done = await streamAgentChat(
      {
        message: content,
        sessionId: activeSessionId.value || undefined,
        context,
      },
      {
        onEvent: (event) => {
          if (event.event === 'thinking' || event.event === 'tool_start' || event.event === 'tool_done')
            pushStreamEvent(event)
          if (event.event === 'supervisor_plan' || event.event === 'stage_update' || event.event === 'warning')
            pushDecisionEvent(event)
          if (event.event === 'message_start' || event.event === 'message_delta')
            applyStreamingAssistantEvent(event)
        },
      },
    )

    if (!done)
      throw new Error('未收到完成事件')

    if (done.content)
      streamingAssistant.content = done.content
    activeSessionId.value = done.sessionId
    await loadSessions(false)
    await openSession(done.sessionId)
    resetStreamingAssistant()
  }
  catch (error: unknown) {
    await recoverLatestSessionAfterFailure()
    resetStreamingAssistant()
    window.$message.error((error as Error)?.message || 'Agent 问股执行失败')
  }
  finally {
    clearFirstEventTimer()
    waitingForFirstEvent.value = false
    sending.value = false
  }
}

function handleDraftEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229)
    return
  event.preventDefault()
  void submitMessage()
}

watch(
  () => queryStockCode.value,
  (value) => {
    if (!value)
      return
    if (!activeSessionId.value && messages.value.length === 0 && !draft.value.trim())
      draft.value = buildQueryPrompt()
  },
  { immediate: true },
)

onMounted(async () => {
  await loadSessions(true)
  if (!activeSessionId.value)
    startNewSession(true)
})

onUnmounted(() => {
  clearFirstEventTimer()
})

watch(
  () => sessions.value.length,
  () => {
    sessionPage.value = Math.min(sessionPage.value, totalSessionPages.value)
  },
)

watch(
  () => [messages.value.length, messages.value[messages.value.length - 1]?.content, streamingAssistant.content, sending.value],
  () => {
    scrollMessageViewportToBottom()
  },
)
</script>

<template>
  <div class="agent-chat-page">
    <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="7">
        <n-card title="历史会话" class="agent-card">
          <template #header-extra>
            <n-space size="small">
              <n-button tertiary @click="loadSessions(false)">
                刷新
              </n-button>
              <n-button tertiary type="primary" @click="startNewSession(true)">
                新建会话
              </n-button>
            </n-space>
          </template>

          <n-alert
            v-if="sessionsLoadError"
            type="error"
            :show-icon="false"
            style="margin-bottom: 12px;"
          >
            {{ sessionsLoadError }}
          </n-alert>

          <n-spin :show="loadingSessions">
            <n-empty
              v-if="sessions.length === 0"
              :description="sessionsLoadError ? '暂未加载到会话，请确认 Backend / Agent 服务状态后重试。' : '还没有会话记录'"
            />
            <n-space v-else vertical :size="12">
              <n-card
                v-for="session in visibleSessions"
                :key="session.sessionId"
                size="small"
                embedded
                class="session-item" :class="[{ active: session.sessionId === activeSessionId }]"
                @click="openSession(session.sessionId)"
              >
                <div class="session-title-row">
                  <n-ellipsis style="max-width: 180px;">
                    {{ session.title || '未命名会话' }}
                  </n-ellipsis>
                  <n-button text type="error" @click.stop="removeSession(session.sessionId)">
                    删除
                  </n-button>
                </div>
                <n-text depth="3" class="session-preview">
                  {{ session.latestMessagePreview || '暂无预览' }}
                </n-text>
                <n-space justify="space-between" size="small" class="session-meta">
                  <n-text depth="3">
                    消息 {{ session.messageCount }}
                  </n-text>
                  <n-text depth="3">
                    {{ session.updatedAt ? session.updatedAt.slice(5, 16).replace('T', ' ') : '--' }}
                  </n-text>
                </n-space>
              </n-card>
              <n-pagination
                v-if="sessions.length > SESSION_PAGE_SIZE"
                v-model:page="sessionPage"
                :page-size="SESSION_PAGE_SIZE"
                :item-count="sessions.length"
                simple
              />
            </n-space>
          </n-spin>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="17">
        <n-space vertical :size="16">
          <n-card title="对话区" class="agent-card">
            <n-spin :show="loadingDetail">
              <div ref="messageScrollRef" class="message-scroll">
                <n-empty v-if="messages.length === 0" description="发第一条消息开始问股" />
                <div
                  v-for="message in messages"
                  :key="`${message.sessionId}-${message.id}`"
                  class="message-row" :class="[message.role === 'user' ? 'from-user' : 'from-assistant']"
                >
                  <div class="message-bubble">
                    <n-space justify="space-between" align="center" size="small">
                      <n-tag :type="message.role === 'user' ? 'info' : 'success'" size="small">
                        {{ message.role === 'user' ? '你' : 'Agent' }}
                      </n-tag>
                      <n-text depth="3">
                        {{ message.createdAt ? message.createdAt.slice(5, 16).replace('T', ' ') : '--' }}
                      </n-text>
                    </n-space>

                    <div class="message-content markdown-body" v-html="renderMessageHtml(message.content)" />

                    <template v-if="asDoneMeta(message)">
                      <n-space
                        v-if="extractControllerPlan(asDoneMeta(message)) || extractDecisionPanel(asDoneMeta(message)).length > 0 || extractStageTraces(asDoneMeta(message)).length > 0"
                        vertical
                        :size="10"
                        class="message-section"
                      >
                        <n-text strong>
                          多 Agent 决策面板
                        </n-text>
                        <n-card
                          v-if="extractControllerPlan(asDoneMeta(message))"
                          embedded
                          size="small"
                        >
                          <n-space justify="space-between" align="center">
                            <n-text strong>
                              主控计划
                            </n-text>
                            <n-tag size="small" type="info">
                              {{ renderControllerPlanStagePriority(asDoneMeta(message)) }}
                            </n-tag>
                          </n-space>
                          <n-text depth="3" style="display: block; margin-top: 8px;">
                            {{ extractControllerPlan(asDoneMeta(message))?.goal || '分析股票并生成保守执行计划' }}
                          </n-text>
                        </n-card>

                        <n-card
                          v-for="(item, index) in extractDecisionPanel(asDoneMeta(message))"
                          :key="`${message.id}-decision-${index}`"
                          embedded
                          size="small"
                        >
                          <n-space justify="space-between" align="center">
                            <n-space size="small">
                              <n-tag size="small" type="success">
                                {{ stageLabel(String(item.stage || '')) }}
                              </n-tag>
                              <n-tag v-if="item.stockCode" size="small">
                                {{ item.stockCode }}
                              </n-tag>
                            </n-space>
                            <n-text depth="3">
                              置信度 {{ formatConfidence(item.confidence) }}
                            </n-text>
                          </n-space>
                          <n-text style="display: block; margin-top: 8px;">
                            {{ item.summary || '--' }}
                          </n-text>
                          <n-text v-if="Array.isArray(item.warnings) && item.warnings.length > 0" depth="3" style="display: block; margin-top: 8px;">
                            警告：{{ item.warnings.join('、') }}
                          </n-text>
                        </n-card>

                        <n-card
                          v-for="(trace, index) in extractStageTraces(asDoneMeta(message))"
                          :key="`${message.id}-trace-${index}`"
                          embedded
                          size="small"
                        >
                          <n-space justify="space-between" align="center">
                            <n-space size="small">
                              <n-tag size="small">
                                {{ stageLabel(String(trace.stage || '')) }}
                              </n-tag>
                              <n-tag v-if="trace.stockCode" size="small">
                                {{ trace.stockCode }}
                              </n-tag>
                            </n-space>
                            <n-text depth="3">
                              {{ trace.state || '--' }}
                            </n-text>
                          </n-space>
                          <n-text depth="3" style="display: block; margin-top: 8px;">
                            {{ trace.summary || '--' }}
                          </n-text>
                        </n-card>
                      </n-space>

                      <n-space v-if="extractAnalysisStocks(asDoneMeta(message)).length > 0" vertical :size="10" class="message-section">
                        <n-text strong>
                          组合结果
                        </n-text>
                        <n-grid :cols="24" :x-gap="12" :y-gap="12">
                          <n-grid-item
                            v-for="stock in extractAnalysisStocks(asDoneMeta(message))"
                            :key="String(stock.code)"
                            :span="24"
                            :m-span="12"
                          >
                            <n-card embedded size="small">
                              <n-space justify="space-between" align="center">
                                <n-text strong>
                                  {{ stock.code }} {{ stock.name }}
                                </n-text>
                                <n-tag size="small" :type="String(stock.action) === 'buy' ? 'success' : String(stock.action) === 'sell' ? 'warning' : 'default'">
                                  {{ stock.operationAdvice || '观望' }}
                                </n-tag>
                              </n-space>
                              <n-space size="small" wrap class="stock-metrics">
                                <n-tag size="small">
                                  现价 {{ stock.currentPrice ?? '--' }}
                                </n-tag>
                                <n-tag size="small">
                                  评分 {{ stock.sentimentScore ?? '--' }}
                                </n-tag>
                                <n-tag size="small">
                                  仓位 {{ stock.targetWeight != null ? `${Number(stock.targetWeight) * 100}%` : '--' }}
                                </n-tag>
                              </n-space>
                              <n-text depth="3">
                                风险提示：{{ Array.isArray(stock.riskFlags) && stock.riskFlags.length ? stock.riskFlags.join('、') : '暂无' }}
                              </n-text>
                            </n-card>
                          </n-grid-item>
                        </n-grid>
                      </n-space>

                      <n-space v-if="extractCandidateOrders(asDoneMeta(message)).length > 0" vertical :size="10" class="message-section">
                        <n-text strong>
                          候选订单
                        </n-text>
                        <n-card
                          v-for="(order, index) in extractCandidateOrders(asDoneMeta(message))"
                          :key="`${message.id}-candidate-${index}`"
                          embedded
                          size="small"
                        >
                          <n-space justify="space-between" align="center">
                            <n-text strong>
                              {{ order.code }} {{ order.stockName || '' }}
                            </n-text>
                            <n-tag size="small" :type="String(order.action) === 'buy' ? 'success' : 'warning'">
                              {{ order.action }}
                            </n-tag>
                          </n-space>
                          <n-text depth="3">
                            数量 {{ order.quantity }}，参考价 {{ order.price }}，理由 {{ order.reason || '--' }}
                          </n-text>
                          <n-text depth="3" style="display: block; margin-top: 6px;">
                            数据源 {{ order.effectiveMarketSource || '--' }}，置信度 {{ formatConfidence(order.confidence) }}
                          </n-text>
                          <n-text v-if="order.adjustmentSummary" depth="3" style="display: block; margin-top: 6px;">
                            执行调整：{{ order.adjustmentSummary }}
                          </n-text>
                          <n-text v-if="Array.isArray(order.warnings) && order.warnings.length > 0" depth="3" style="display: block; margin-top: 6px;">
                            警告：{{ order.warnings.join('、') }}
                          </n-text>
                        </n-card>
                      </n-space>

                      <n-space v-if="extractExecution(asDoneMeta(message))" vertical :size="10" class="message-section">
                        <n-text strong>
                          执行结果
                        </n-text>
                        <n-alert
                          v-if="isOutsideTradingSessionExecution(extractExecution(asDoneMeta(message)))"
                          type="warning"
                          :show-icon="false"
                        >
                          <n-space vertical :size="6">
                            <n-text strong>
                              非交易时段未执行
                            </n-text>
                            <n-text>
                              {{ extractExecutionMessage(extractExecution(asDoneMeta(message))) }}
                            </n-text>
                            <n-text depth="3">
                              交易时段 {{ renderSessionLabels(extractExecutionSessionGuard(extractExecution(asDoneMeta(message)))) }}
                              （{{ extractExecutionSessionGuard(extractExecution(asDoneMeta(message)))?.timezone || '--' }}）
                            </n-text>
                            <n-text depth="3">
                              下次可执行时间 {{ formatDateTime(extractExecutionSessionGuard(extractExecution(asDoneMeta(message)))?.nextOpenAt || null) }}
                            </n-text>
                          </n-space>
                        </n-alert>
                        <n-card embedded size="small">
                          <n-text strong>
                            {{ renderExecutionSummary(extractExecution(asDoneMeta(message))) }}
                          </n-text>
                          <n-text depth="3" style="display: block; margin-top: 8px;">
                            {{ extractExecutionMessage(extractExecution(asDoneMeta(message))) || `状态 ${extractExecution(asDoneMeta(message))?.status || '--'}` }}
                          </n-text>
                          <n-text v-if="extractExecution(asDoneMeta(message))?.adjustmentReason" depth="3" style="display: block; margin-top: 8px;">
                            调整原因：{{ extractExecution(asDoneMeta(message))?.adjustmentReason }}
                          </n-text>
                          <n-text v-if="extractExecution(asDoneMeta(message))?.riskReductionOnly" depth="3" style="display: block; margin-top: 8px;">
                            本次调整仅允许向更保守方向收缩风险。
                          </n-text>
                        </n-card>
                      </n-space>
                    </template>
                  </div>
                </div>

                <div
                  v-if="streamingAssistant.createdAt"
                  class="message-row from-assistant"
                >
                  <div class="message-bubble is-streaming">
                    <n-space justify="space-between" align="center" size="small">
                      <n-tag type="success" size="small">
                        Agent
                      </n-tag>
                      <n-text depth="3">
                        {{ streamingAssistant.createdAt ? streamingAssistant.createdAt.slice(5, 16).replace('T', ' ') : '--' }}
                      </n-text>
                    </n-space>

                    <div class="message-content markdown-body" v-html="renderStreamingAssistantHtml()" />
                    <span v-if="sending" class="stream-caret" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </n-spin>
          </n-card>

          <n-card v-if="streamEvents.length > 0 || sending" title="SSE 进度" class="agent-card">
            <n-space vertical :size="10">
              <n-card
                v-for="item in streamEvents"
                :key="item.key"
                embedded
                size="small"
              >
                <n-space justify="space-between" align="center">
                  <n-tag size="small" :type="eventTagType(item.event)">
                    {{ eventLabel(item.event) }}
                  </n-tag>
                  <n-text depth="3">
                    {{ item.summary }}
                  </n-text>
                </n-space>
              </n-card>
              <n-alert v-if="sending" type="info" :show-icon="false">
                正在等待 Agent 完成当前轮次...
              </n-alert>
              <n-alert v-if="waitingForFirstEvent" type="warning" :show-icon="false">
                请求已发出，但暂时还没有收到进度事件。请检查 Backend / Agent 是否通过健康检查，或重新执行工作区根目录的 bash scripts/system/start.sh。
              </n-alert>
            </n-space>
          </n-card>

          <n-card v-if="decisionEvents.length > 0 || sending" title="多 Agent 决策面板" class="agent-card">
            <n-space vertical :size="10">
              <n-card
                v-for="item in decisionEvents"
                :key="item.key"
                embedded
                size="small"
              >
                <n-space justify="space-between" align="center">
                  <n-space size="small">
                    <n-tag size="small" :type="decisionTagType(item.kind)">
                      {{ item.kind === 'plan' ? '主控' : item.kind === 'warning' ? '警告' : stageLabel(item.stage) }}
                    </n-tag>
                    <n-tag v-if="item.stockCode" size="small">
                      {{ item.stockCode }}
                    </n-tag>
                  </n-space>
                  <n-text depth="3">
                    {{ item.confidence != null ? `置信度 ${formatConfidence(item.confidence)}` : '--' }}
                  </n-text>
                </n-space>
                <n-text style="display: block; margin-top: 8px;">
                  {{ item.summary }}
                </n-text>
                <n-text v-if="item.warnings.length > 0" depth="3" style="display: block; margin-top: 8px;">
                  警告：{{ item.warnings.join('、') }}
                </n-text>
              </n-card>
            </n-space>
          </n-card>

          <n-card title="输入区" class="agent-card">
            <n-space vertical :size="12">
              <n-input
                v-model:value="draft"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="例如：帮我分析一下今天的 600519 的行情；然后在看到候选订单后再说：去下单吧。"
                @keydown.enter.exact="handleDraftEnter"
              />
              <n-space justify="space-between" align="center">
                <n-text depth="3">
                  `Enter` 发送，`Shift + Enter` 换行
                </n-text>
                <n-button type="primary" :loading="sending" @click="submitMessage">
                  发送
                </n-button>
              </n-space>
            </n-space>
          </n-card>
        </n-space>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<style scoped>
.agent-chat-page {
  min-height: calc(100vh - 120px);
}

.agent-card {
  border-radius: 18px;
}

.session-item {
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.session-item.active {
  border-color: var(--n-primary-color);
  transform: translateY(-1px);
}

.session-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.session-preview {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
}

.session-meta {
  margin-top: 8px;
}

.message-scroll {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 360px;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 6px;
}

.message-row {
  display: flex;
}

.message-row.from-user {
  justify-content: flex-end;
}

.message-row.from-assistant {
  justify-content: flex-start;
}

.message-bubble {
  width: min(100%, 860px);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
}

.from-user .message-bubble {
  background: rgb(239 246 255);
  border-color: rgb(147 197 253);
}

.message-bubble.is-streaming {
  position: relative;
}

.message-content {
  margin-top: 10px;
  color: rgb(15 23 42);
}

.message-section {
  margin-top: 14px;
}

.stock-metrics {
  margin: 8px 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 10px 0 8px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
  line-height: 1.7;
}

.markdown-body :deep(ul) {
  margin: 8px 0;
  padding-left: 18px;
}

.markdown-body :deep(li) {
  margin: 6px 0;
  line-height: 1.6;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgb(241 245 249);
  color: rgb(15 23 42);
}

.markdown-body :deep(pre) {
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  color: rgb(15 23 42);
  line-height: 1.7;
}

.markdown-body :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  color: inherit;
}

.stream-caret {
  display: inline-block;
  width: 9px;
  height: 1.1em;
  margin-top: 10px;
  border-radius: 999px;
  background: rgb(37 99 235);
  animation: stream-caret-blink 1s ease-in-out infinite;
}

@keyframes stream-caret-blink {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 1024px) {
  .message-scroll {
    max-height: none;
  }
}
</style>
