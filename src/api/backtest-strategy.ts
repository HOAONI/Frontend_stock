/** 策略回测接口封装，负责运行回测、管理策略模板和用户策略。 */
import client from './client'
import { toCamelCase } from './case'
import type {
  BacktestStrategyTemplateListResponse,
  CreateUserBacktestStrategyRequest,
  StrategyRangeRunRequest,
  StrategyRangeRunResponse,
  StrategyRunHistoryResponse,
  UpdateUserBacktestStrategyRequest,
  UserBacktestStrategyItem,
  UserBacktestStrategyListResponse,
} from '@/types/backtest-strategy'

export async function runStrategyBacktest(payload: StrategyRangeRunRequest): Promise<StrategyRangeRunResponse> {
  const body: Record<string, unknown> = {
    code: payload.code,
    start_date: payload.startDate,
    end_date: payload.endDate,
  }
  if (payload.strategyIds && payload.strategyIds.length > 0)
    body.strategy_ids = payload.strategyIds
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

export async function listBacktestStrategyTemplates(): Promise<BacktestStrategyTemplateListResponse> {
  const { data } = await client.get('/api/v1/backtest/strategies/templates')
  return toCamelCase<BacktestStrategyTemplateListResponse>(data)
}

export async function listUserBacktestStrategies(): Promise<UserBacktestStrategyListResponse> {
  const { data } = await client.get('/api/v1/backtest/strategies')
  return toCamelCase<UserBacktestStrategyListResponse>(data)
}

export async function createUserBacktestStrategy(payload: CreateUserBacktestStrategyRequest): Promise<UserBacktestStrategyItem> {
  const { data } = await client.post('/api/v1/backtest/strategies', {
    name: payload.name,
    description: payload.description,
    template_code: payload.templateCode,
    params: payload.params,
  })
  return toCamelCase<UserBacktestStrategyItem>(data)
}

export async function updateUserBacktestStrategy(
  strategyId: number,
  payload: UpdateUserBacktestStrategyRequest,
): Promise<UserBacktestStrategyItem> {
  const body: Record<string, unknown> = {}
  if (payload.name != null)
    body.name = payload.name
  if (payload.description != null)
    body.description = payload.description
  if (payload.templateCode != null)
    body.template_code = payload.templateCode
  if (payload.params != null)
    body.params = payload.params

  const { data } = await client.patch(`/api/v1/backtest/strategies/${strategyId}`, body)
  return toCamelCase<UserBacktestStrategyItem>(data)
}

export async function deleteUserBacktestStrategy(strategyId: number): Promise<{ deleted: boolean }> {
  const { data } = await client.delete(`/api/v1/backtest/strategies/${strategyId}`)
  return toCamelCase<{ deleted: boolean }>(data)
}
