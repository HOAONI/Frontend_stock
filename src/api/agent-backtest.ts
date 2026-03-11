import client from './client'
import { toCamelCase } from './case'
import type {
  AgentBacktestDetailResponse,
  AgentBacktestHistoryResponse,
  AgentBacktestRunRequest,
} from '@/types/agent-backtest'

export async function runAgentBacktest(payload: AgentBacktestRunRequest): Promise<AgentBacktestDetailResponse> {
  const body: Record<string, unknown> = {
    code: payload.code,
    start_date: payload.startDate,
    end_date: payload.endDate,
  }
  if (payload.initialCapital != null)
    body.initial_capital = payload.initialCapital
  if (payload.commissionRate != null)
    body.commission_rate = payload.commissionRate
  if (payload.slippageBps != null)
    body.slippage_bps = payload.slippageBps
  if (payload.runtimeStrategy)
    body.runtime_strategy = payload.runtimeStrategy
  if (payload.enableRefine != null)
    body.enable_refine = payload.enableRefine

  const { data } = await client.post('/api/v1/backtest/agent/run', body)
  return toCamelCase<AgentBacktestDetailResponse>(data)
}

export async function listAgentBacktestRuns(params: {
  code?: string
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
} = {}): Promise<AgentBacktestHistoryResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }
  if (params.code)
    query.code = params.code
  if (params.status)
    query.status = params.status
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/backtest/agent/runs', { params: query })
  return toCamelCase<AgentBacktestHistoryResponse>(data)
}

export async function getAgentBacktestRunDetail(runGroupId: number): Promise<AgentBacktestDetailResponse> {
  const { data } = await client.get(`/api/v1/backtest/agent/runs/${runGroupId}`)
  return toCamelCase<AgentBacktestDetailResponse>(data)
}
