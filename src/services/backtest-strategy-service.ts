import {
  createUserBacktestStrategy,
  deleteUserBacktestStrategy,
  getStrategyBacktestRunDetail,
  listBacktestStrategyTemplates,
  listStrategyBacktestRuns,
  listUserBacktestStrategies,
  runStrategyBacktest,
  updateUserBacktestStrategy,
} from '@/api/backtest-strategy'
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
import { getDataMode } from './data-source'

export interface StrategyRunHistoryInput {
  code?: string
  strategyCode?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

// 后端历史列表字段兼容多版返回，这里统一做一次兜底，页面无需再重复判空。
function ensureListResponse(data: StrategyRunHistoryResponse): StrategyRunHistoryResponse {
  return {
    total: Number(data.total || 0),
    page: Number(data.page || 1),
    limit: Number(data.limit || 20),
    items: Array.isArray(data.items) ? data.items : [],
    legacyEventBacktest: Boolean(data.legacyEventBacktest),
  }
}

export async function runStrategyRangeBacktest(input: StrategyRangeRunRequest): Promise<{
  data: StrategyRangeRunResponse
  dataSource: 'api' | 'mock'
}> {
  const data = await runStrategyBacktest(input)
  return {
    data,
    dataSource: getDataMode() === 'mock' ? 'mock' : 'api',
  }
}

export async function fetchStrategyRunHistory(input: StrategyRunHistoryInput): Promise<StrategyRunHistoryResponse> {
  const data = await listStrategyBacktestRuns(input)
  return ensureListResponse(data)
}

export async function fetchStrategyRunDetail(runGroupId: number): Promise<StrategyRangeRunResponse> {
  return await getStrategyBacktestRunDetail(runGroupId)
}

export async function fetchBacktestStrategyTemplates(): Promise<BacktestStrategyTemplateListResponse> {
  return await listBacktestStrategyTemplates()
}

export async function fetchUserBacktestStrategies(): Promise<UserBacktestStrategyListResponse> {
  return await listUserBacktestStrategies()
}

export async function createMyBacktestStrategy(payload: CreateUserBacktestStrategyRequest): Promise<UserBacktestStrategyItem> {
  return await createUserBacktestStrategy(payload)
}

export async function updateMyBacktestStrategy(
  strategyId: number,
  payload: UpdateUserBacktestStrategyRequest,
): Promise<UserBacktestStrategyItem> {
  return await updateUserBacktestStrategy(strategyId, payload)
}

export async function deleteMyBacktestStrategy(strategyId: number): Promise<{ deleted: boolean }> {
  return await deleteUserBacktestStrategy(strategyId)
}
