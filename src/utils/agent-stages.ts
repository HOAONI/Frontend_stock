import type { AgentStageCode, AgentStageItem, AgentStageResult, AgentStageStatus } from '@/types/agent-stages'

interface StageSource {
  code: AgentStageCode
  title: string
  payload: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  return value as Record<string, unknown>
}

function resolveStatus(payload: Record<string, unknown> | null): AgentStageStatus {
  if (!payload)
    return 'pending'

  const errorMessage = String(payload.error_message ?? payload.errorMessage ?? '').trim()
  if (errorMessage)
    return 'failed'

  if (Object.keys(payload).length > 0)
    return 'done'

  return 'pending'
}

function summarize(code: AgentStageCode, payload: Record<string, unknown> | null): string {
  if (!payload)
    return '暂无阶段数据'

  if (code === 'data') {
    const hasQuote = Boolean(payload.realtime_quote || payload.realtime)
    const hasContext = Boolean(payload.analysis_context || payload.context)
    return `数据准备 ${hasQuote ? '含实时行情' : '无实时行情'}，${hasContext ? '含上下文' : '无上下文'}`
  }

  if (code === 'signal') {
    const advice = String(payload.operation_advice ?? payload.operationAdvice ?? '').trim()
    const trend = String(payload.trend_signal ?? payload.trendPrediction ?? '').trim()
    return `信号输出：${advice || '--'} / 趋势：${trend || '--'}`
  }

  if (code === 'risk') {
    const stopLoss = payload.stop_loss ?? payload.stopLoss
    const takeProfit = payload.take_profit ?? payload.takeProfit
    return `风控边界：止损 ${stopLoss ?? '--'}，止盈 ${takeProfit ?? '--'}`
  }

  const action = String(payload.action ?? payload.order_action ?? payload.decision ?? '').trim()
  return `执行建议：${action || '无明确指令'}`
}

function pickInputOutput(payload: Record<string, unknown> | null): { input: Record<string, unknown> | null, output: Record<string, unknown> | null } {
  if (!payload)
    return { input: null, output: null }

  const input = asRecord(payload.input) || asRecord(payload.request) || asRecord(payload.request_payload)
  const output = asRecord(payload.output) || asRecord(payload.response) || asRecord(payload.ai_payload)

  return {
    input: input || null,
    output: output || payload,
  }
}

function getDuration(payload: Record<string, unknown> | null): number | null {
  if (!payload)
    return null
  const raw = Number(payload.duration_ms ?? payload.durationMs)
  if (!Number.isFinite(raw) || raw < 0)
    return null
  return raw
}

export function parseAgentStagesFromRawResult(rawResult: unknown): AgentStageResult {
  const root = asRecord(rawResult)
  const warnings: string[] = []

  if (!root)
    warnings.push('raw_result 不是对象，阶段信息已回退为空')

  const sources: StageSource[] = [
    { code: 'data', title: '数据获取 Agent', payload: asRecord(root?.data_snapshot) },
    { code: 'signal', title: '信号策略 Agent', payload: asRecord(root?.signal_snapshot) },
    { code: 'risk', title: '风险控制 Agent', payload: asRecord(root?.risk_snapshot) },
    { code: 'execution', title: '执行 Agent', payload: asRecord(root?.execution_snapshot) },
  ]

  const stages: AgentStageItem[] = sources.map((item) => {
    const status = resolveStatus(item.payload)
    const io = pickInputOutput(item.payload)
    return {
      code: item.code,
      title: item.title,
      status,
      summary: summarize(item.code, item.payload),
      durationMs: getDuration(item.payload),
      input: io.input,
      output: io.output,
      errorMessage: String(item.payload?.error_message ?? item.payload?.errorMessage ?? '').trim() || null,
    }
  })

  return {
    stages,
    warnings,
  }
}
