import {
  getStrategyBacktestRunDetail,
  listStrategyBacktestRuns,
  runStrategyBacktest,
} from '@/api/backtest-strategy'
import type {
  StrategyRangeRunRequest,
  StrategyRangeRunResponse,
  StrategyRunHistoryResponse,
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
