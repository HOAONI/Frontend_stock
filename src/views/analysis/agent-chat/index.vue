<script setup lang="ts">
import { deleteAgentChatSession, getAgentChatSession, listAgentChatSessions, streamAgentChat } from '@/api/agent-chat'
import type { AgentChatDoneResponse, AgentChatMessage, AgentChatSessionItem, AgentChatStreamEvent } from '@/types/agent-chat'
import { renderSimpleMarkdown } from '@/utils/simple-markdown'

interface StreamProgressItem {
  key: string
  event: AgentChatStreamEvent['event']
  summary: string
}

const route = useRoute()
const router = useRouter()

const sessions = ref<AgentChatSessionItem[]>([])
const activeSessionId = ref('')
const messages = ref<AgentChatMessage[]>([])
const draft = ref('')
const loadingSessions = ref(false)
const loadingDetail = ref(false)
const sending = ref(false)
const streamEvents = ref<StreamProgressItem[]>([])
const waitingForFirstEvent = ref(false)
const sessionsLoadError = ref('')

const STARTUP_HINT = '联调前请先在工作区根目录运行 bash scripts/system/start.sh，确保 Frontend / Backend / Agent 都已启动并通过健康检查。'

let firstEventTimer: number | null = null

const activeSession = computed(() => sessions.value.find(item => item.sessionId === activeSessionId.value) || null)
const queryStockCode = computed(() => String(route.query.stockCode || '').trim())
const currentSessionTitle = computed(() => activeSession.value?.title || 'Agent问股')

function makeStreamKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildQueryPrompt() {
  if (!queryStockCode.value)
    return ''
  return `帮我分析一下今天的 ${queryStockCode.value} 行情`
}

function startNewSession(resetDraft = true) {
  activeSessionId.value = ''
  messages.value = []
  streamEvents.value = []
  waitingForFirstEvent.value = false
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
    messages.value = detail.messages || []
    streamEvents.value = []
  }
  catch (error: unknown) {
    window.$message.error((error as Error)?.message || '加载会话详情失败')
  }
  finally {
    loadingDetail.value = false
  }
}

async function removeSession(sessionId: string) {
  if (!window.confirm('确认删除该会话吗？'))
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
  if (event === 'done')
    return '完成'
  return '错误'
}

function eventTagType(event: AgentChatStreamEvent['event']): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (event === 'thinking')
    return 'info'
  if (event === 'tool_start')
    return 'warning'
  if (event === 'tool_done' || event === 'done')
    return 'success'
  return 'error'
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

function extractExecution(meta: AgentChatDoneResponse | null): Record<string, unknown> | null {
  if (!meta?.executionResult || typeof meta.executionResult !== 'object')
    return null
  return meta.executionResult
}

function renderMessageHtml(content: string) {
  return renderSimpleMarkdown(content)
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
  scheduleFirstEventHint()

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
        },
      },
    )

    if (!done)
      throw new Error('未收到完成事件')

    activeSessionId.value = done.sessionId
    await loadSessions(false)
    await openSession(done.sessionId)
  }
  catch (error: unknown) {
    window.$message.error((error as Error)?.message || 'Agent 问股执行失败')
  }
  finally {
    clearFirstEventTimer()
    waitingForFirstEvent.value = false
    sending.value = false
  }
}

function usePrompt(prompt: string) {
  draft.value = prompt
}

function jumpFromAnalysis(stockCode: string) {
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      stockCode,
    },
  })
  draft.value = `帮我分析一下今天的 ${stockCode} 行情`
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
                v-for="session in sessions"
                :key="session.sessionId"
                size="small"
                embedded
                :class="['session-item', { active: session.sessionId === activeSessionId }]"
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
                  <n-text depth="3">消息 {{ session.messageCount }}</n-text>
                  <n-text depth="3">{{ session.updatedAt ? session.updatedAt.slice(5, 16).replace('T', ' ') : '--' }}</n-text>
                </n-space>
              </n-card>
            </n-space>
          </n-spin>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="17">
        <n-space vertical :size="16">
          <n-card :title="currentSessionTitle" class="agent-card">
            <template #header-extra>
              <n-space size="small" align="center">
                <n-tag type="info" size="small">
                  所有登录用户可见
                </n-tag>
                <n-tag size="small">
                  仅隔离自己的会话与模拟盘
                </n-tag>
              </n-space>
            </template>

            <n-space vertical :size="12">
              <n-alert type="info" :show-icon="false">
                直接描述你的需求，例如“帮我分析一下今天的 600519 和 000001”，或者在看到候选订单后说“去下单吧”。
              </n-alert>
              <n-alert type="warning" :show-icon="false">
                {{ STARTUP_HINT }}
              </n-alert>

              <n-space size="small" wrap>
                <n-button secondary size="small" @click="usePrompt('帮我分析一下今天的 600519 行情')">
                  分析 600519
                </n-button>
                <n-button secondary size="small" @click="usePrompt('帮我分析一下今天的 600519 和 000001，并给出组合建议')">
                  多股票组合
                </n-button>
                <n-button secondary size="small" @click="usePrompt('看看我当前模拟盘持仓和资金情况')">
                  模拟盘上下文
                </n-button>
                <n-button
                  v-if="queryStockCode"
                  tertiary
                  size="small"
                  @click="jumpFromAnalysis(queryStockCode)"
                >
                  带入 {{ queryStockCode }}
                </n-button>
              </n-space>
            </n-space>
          </n-card>

          <n-card title="对话区" class="agent-card">
            <n-spin :show="loadingDetail">
              <div class="message-scroll">
                <n-empty v-if="messages.length === 0" description="发第一条消息开始问股" />
                <div
                  v-for="message in messages"
                  :key="`${message.sessionId}-${message.id}`"
                  :class="['message-row', message.role === 'user' ? 'from-user' : 'from-assistant']"
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
                      <n-space v-if="extractAnalysisStocks(asDoneMeta(message)).length > 0" vertical :size="10" class="message-section">
                        <n-text strong>组合结果</n-text>
                        <n-grid :cols="24" :x-gap="12" :y-gap="12">
                          <n-grid-item
                            v-for="stock in extractAnalysisStocks(asDoneMeta(message))"
                            :key="String(stock.code)"
                            :span="24"
                            :m-span="12"
                          >
                            <n-card embedded size="small">
                              <n-space justify="space-between" align="center">
                                <n-text strong>{{ stock.code }} {{ stock.name }}</n-text>
                                <n-tag size="small" :type="String(stock.action) === 'buy' ? 'success' : String(stock.action) === 'sell' ? 'warning' : 'default'">
                                  {{ stock.operationAdvice || '观望' }}
                                </n-tag>
                              </n-space>
                              <n-space size="small" wrap class="stock-metrics">
                                <n-tag size="small">现价 {{ stock.currentPrice ?? '--' }}</n-tag>
                                <n-tag size="small">评分 {{ stock.sentimentScore ?? '--' }}</n-tag>
                                <n-tag size="small">仓位 {{ stock.targetWeight != null ? `${Number(stock.targetWeight) * 100}%` : '--' }}</n-tag>
                              </n-space>
                              <n-text depth="3">
                                风险提示：{{ Array.isArray(stock.riskFlags) && stock.riskFlags.length ? stock.riskFlags.join('、') : '暂无' }}
                              </n-text>
                            </n-card>
                          </n-grid-item>
                        </n-grid>
                      </n-space>

                      <n-space v-if="extractCandidateOrders(asDoneMeta(message)).length > 0" vertical :size="10" class="message-section">
                        <n-text strong>候选订单</n-text>
                        <n-card
                          v-for="(order, index) in extractCandidateOrders(asDoneMeta(message))"
                          :key="`${message.id}-candidate-${index}`"
                          embedded
                          size="small"
                        >
                          <n-space justify="space-between" align="center">
                            <n-text strong>{{ order.code }} {{ order.stockName || '' }}</n-text>
                            <n-tag size="small" :type="String(order.action) === 'buy' ? 'success' : 'warning'">
                              {{ order.action }}
                            </n-tag>
                          </n-space>
                          <n-text depth="3">
                            数量 {{ order.quantity }}，参考价 {{ order.price }}，理由 {{ order.reason || '--' }}
                          </n-text>
                        </n-card>
                      </n-space>

                      <n-space v-if="extractExecution(asDoneMeta(message))" vertical :size="10" class="message-section">
                        <n-text strong>执行结果</n-text>
                        <n-card embedded size="small">
                          <n-text>
                            {{ extractExecution(asDoneMeta(message))?.status || '--' }}
                          </n-text>
                          <n-text depth="3" style="display: block; margin-top: 8px;">
                            {{ JSON.stringify(extractExecution(asDoneMeta(message))) }}
                          </n-text>
                        </n-card>
                      </n-space>
                    </template>
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
                  <n-text depth="3">{{ item.summary }}</n-text>
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

          <n-card title="输入区" class="agent-card">
            <n-space vertical :size="12">
              <n-input
                v-model:value="draft"
                type="textarea"
                :autosize="{ minRows: 4, maxRows: 8 }"
                placeholder="例如：帮我分析一下今天的 600519 的行情；然后在看到候选订单后再说：去下单吧。"
                @keyup.ctrl.enter="submitMessage"
              />
              <n-space justify="space-between" align="center">
                <n-text depth="3">
                  `Ctrl + Enter` 发送
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

@media (max-width: 1024px) {
  .message-scroll {
    max-height: none;
  }
}
</style>
