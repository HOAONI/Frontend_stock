import type {
  AgentChatDoneResponse,
  AgentChatRequest,
  AgentChatSessionDetail,
  AgentChatSessionItem,
  AgentChatStreamEvent,
} from '@/types/agent-chat'
import client from './client'
import { toCamelCase } from './case'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function buildRequestBody(payload: AgentChatRequest) {
  return {
    message: payload.message,
    session_id: payload.sessionId,
    context: payload.context,
  }
}

function getStreamUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/'
  if (base === '/')
    return '/api/v1/agent/chat/stream'
  return `${base.replace(/\/$/, '')}/api/v1/agent/chat/stream`
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data))
    return fallback

  const detail = data.detail
  if (typeof detail === 'string' && detail.trim())
    return detail.trim()
  if (isRecord(detail)) {
    const nested = String(detail.message || detail.error || '').trim()
    if (nested)
      return nested
  }

  const direct = String(data.message || data.error || '').trim()
  return direct || fallback
}

function extractErrorCode(data: unknown): string {
  if (!isRecord(data))
    return ''

  const detail = data.detail
  if (isRecord(detail))
    return String(detail.error || '').trim().toLowerCase()

  return String(data.error || '').trim().toLowerCase()
}

function buildStartupHint(service: 'backend' | 'agent' | 'fullstack'): string {
  if (service === 'backend')
    return '无法连接 Backend 服务，请先在工作区根目录运行 `bash scripts/system/start.sh`，并确认 Backend 健康检查通过。'
  if (service === 'agent')
    return 'Agent 服务不可用，请先在工作区根目录运行 `bash scripts/system/start.sh`，并确认 Agent / Backend 健康检查通过。'
  return '全链路服务尚未就绪，请先在工作区根目录运行 `bash scripts/system/start.sh`，并确认 Frontend / Backend / Agent 都已启动。'
}

function isGenericServerErrorMessage(message: string, code: string): boolean {
  return !message
    || message === 'internal server error'
    || message === 'server error'
    || code === 'internal_server_error'
    || code === 'server_error'
}

function classifyHttpError(status: number | undefined, data: unknown, fallback: string): string {
  const message = extractErrorMessage(data, fallback)
  const code = extractErrorCode(data)
  const normalized = message.toLowerCase()

  if (status === 401 && (code === 'unauthorized' || normalized.includes('login required')))
    return '登录状态已失效，请重新登录。'

  if (status === 412 && code === 'simulation_account_required')
    return message || '请先初始化并校验模拟盘账户。'

  if (status === 502 || status === 503 || status === 504) {
    if (code === 'upstream_error'
      || normalized.includes('agent')
      || normalized.includes('fetch failed')
      || normalized.includes('stream is unavailable')
      || normalized.includes('timeout')) {
      return `${message} ${buildStartupHint('agent')}`.trim()
    }
    return `${message} ${buildStartupHint('fullstack')}`.trim()
  }

  if (status === 500 && (code === 'upstream_error' || isGenericServerErrorMessage(normalized, code))) {
    const friendlyMessage = isGenericServerErrorMessage(normalized, code)
      ? 'Agent 问股服务异常。'
      : message
    return `${friendlyMessage} ${buildStartupHint('agent')}`.trim()
  }

  return message
}

function normalizeTransportError(error: unknown, fallback: string): Error {
  const maybeAxios = error as {
    response?: {
      status?: number
      data?: unknown
    }
    message?: string
  }

  if (maybeAxios?.response) {
    return new Error(classifyHttpError(maybeAxios.response.status, maybeAxios.response.data, fallback))
  }

  const message = String((error as Error | undefined)?.message || '').trim()
  if (!message)
    return new Error(fallback)

  if (message === 'Failed to fetch' || message.includes('NetworkError'))
    return new Error(buildStartupHint('backend'))

  return new Error(message)
}

function isAgentChatDoneResponse(value: unknown): value is AgentChatDoneResponse {
  if (!isRecord(value))
    return false

  return typeof value.sessionId === 'string'
    && value.sessionId.trim().length > 0
    && typeof value.content === 'string'
    && typeof value.status === 'string'
    && Array.isArray(value.candidateOrders)
}

function parseDonePayload(data: unknown): AgentChatDoneResponse {
  const payload = toCamelCase<unknown>(data)
  if (!isAgentChatDoneResponse(payload))
    throw new Error('Agent done 事件载荷不完整')
  return payload
}

export async function sendAgentChat(payload: AgentChatRequest): Promise<AgentChatDoneResponse> {
  try {
    const { data } = await client.post('/api/v1/agent/chat', buildRequestBody(payload))
    return parseDonePayload(data)
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, 'Agent 问股请求失败')
  }
}

export async function listAgentChatSessions(limit = 50): Promise<{ total: number, items: AgentChatSessionItem[] }> {
  try {
    const { data } = await client.get('/api/v1/agent/chat/sessions', { params: { limit } })
    const result = toCamelCase<{ total: number, items: AgentChatSessionItem[] }>(data)
    return {
      total: Number(result.total ?? 0),
      items: (result.items || []).map(item => toCamelCase<AgentChatSessionItem>(item)),
    }
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, '加载会话列表失败')
  }
}

export async function getAgentChatSession(sessionId: string): Promise<AgentChatSessionDetail> {
  try {
    const { data } = await client.get(`/api/v1/agent/chat/sessions/${encodeURIComponent(sessionId)}`)
    return toCamelCase<AgentChatSessionDetail>(data)
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, '加载会话详情失败')
  }
}

export async function deleteAgentChatSession(sessionId: string): Promise<void> {
  try {
    await client.delete(`/api/v1/agent/chat/sessions/${encodeURIComponent(sessionId)}`)
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, '删除会话失败')
  }
}

interface StreamAgentChatOptions {
  onEvent?: (event: AgentChatStreamEvent) => void
}

function parseSseBlock(block: string): AgentChatStreamEvent | null {
  const lines = block.split('\n')
  let event = ''
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:'))
      event = line.slice(6).trim()
    else if (line.startsWith('data:'))
      dataLines.push(line.slice(5).trim())
  }
  if (!event)
    return null
  const rawData = dataLines.join('\n')
  let parsed: Record<string, unknown> = {}
  if (rawData) {
    try {
      parsed = toCamelCase<Record<string, unknown>>(JSON.parse(rawData))
    }
    catch {
      parsed = { message: rawData }
    }
  }
  return {
    event: event as AgentChatStreamEvent['event'],
    data: parsed,
  }
}

export async function streamAgentChat(
  payload: AgentChatRequest,
  options: StreamAgentChatOptions = {},
): Promise<AgentChatDoneResponse | null> {
  let response: Response
  try {
    response = await fetch(getStreamUrl(), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(buildRequestBody(payload)),
    })
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, 'Agent 问股请求失败')
  }

  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    }
    catch {
      try {
        data = { message: await response.text() }
      }
      catch {
        data = null
      }
    }
    throw new Error(classifyHttpError(response.status, data, 'Agent 问股请求失败'))
  }

  const reader = response.body?.getReader()
  if (!reader)
    throw new Error('浏览器不支持流式响应')

  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload: AgentChatDoneResponse | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })
      while (true) {
        const splitIndex = buffer.indexOf('\n\n')
        if (splitIndex < 0)
          break
        const block = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex + 2)
        const parsed = parseSseBlock(block)
        if (!parsed)
          continue
        options.onEvent?.(parsed)
        if (parsed.event === 'done')
          donePayload = parseDonePayload(parsed.data)
        if (parsed.event === 'error')
          throw normalizeTransportError({ response: { status: 502, data: parsed.data } }, 'Agent 问股执行失败')
      }
    }
  }
  catch (error: unknown) {
    throw normalizeTransportError(error, 'Agent 问股流式请求失败')
  }

  if (!donePayload)
    throw new Error('Agent 流已结束，但未收到完成事件')

  return donePayload
}
