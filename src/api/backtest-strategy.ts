import client from './client'
import { toCamelCase } from './case'
import type {
  StrategyRangeRunRequest,
  StrategyRangeRunResponse,
  StrategyRunHistoryResponse,
} from '@/types/backtest-strategy'

export async function runStrategyBacktest(payload: StrategyRangeRunRequest): Promise<StrategyRangeRunResponse> {
  const body: Record<string, unknown> = {
    code: payload.code,
    start_date: payload.startDate,
    end_date: payload.endDate,
  }
  if (payload.strategyCodes && payload.strategyCodes.length > 0)
    body.strategy_codes = payload.strategyCodes
  if (payload.initialCapital != null)
    body.initial_capital = payload.initialCapital
  if (payload.commissionRate != null)
    body.commission_rate = payload.commissionRate
  if (payload.slippageBps != null)
    body.slippage_bps = payload.slippageBps

  const { data } = await client.post('/api/v1/backtest/strategy/run', body)
  return toCamelCase<StrategyRangeRunResponse>(data)
}

export async function listStrategyBacktestRuns(params: {
  code?: string
  strategyCode?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
} = {}): Promise<StrategyRunHistoryResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }
  if (params.code)
    query.code = params.code
  if (params.strategyCode)
    query.strategy_code = params.strategyCode
  if (params.startDate)
    query.start_date = params.startDate
  if (params.endDate)
    query.end_date = params.endDate

  const { data } = await client.get('/api/v1/backtest/strategy/runs', { params: query })
  return toCamelCase<StrategyRunHistoryResponse>(data)
}

export async function getStrategyBacktestRunDetail(runGroupId: number): Promise<StrategyRangeRunResponse> {
  const { data } = await client.get(`/api/v1/backtest/strategy/runs/${runGroupId}`)
  return toCamelCase<StrategyRangeRunResponse>(data)
}
