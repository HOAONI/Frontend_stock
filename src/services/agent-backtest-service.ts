import {
  getAgentBacktestRunDetail,
  listAgentBacktestRuns,
  runAgentBacktest,
} from '@/api/agent-backtest'
import type {
  AgentBacktestDetailResponse,
  AgentBacktestHistoryResponse,
  AgentBacktestRunRequest,
} from '@/types/agent-backtest'
import { getDataMode } from './data-source'

export interface AgentBacktestHistoryInput {
  code?: string
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

// Agent 回放历史接口也统一补 total/page/items 默认值，减少页面分支。
function ensureListResponse(data: AgentBacktestHistoryResponse): AgentBacktestHistoryResponse {
  return {
    total: Number(data.total || 0),
    page: Number(data.page || 1),
    limit: Number(data.limit || 20),
    items: Array.isArray(data.items) ? data.items : [],
    legacyEventBacktest: Boolean(data.legacyEventBacktest),
  }
}

export async function runAgentReplayBacktest(input: AgentBacktestRunRequest): Promise<{
  data: AgentBacktestDetailResponse
  dataSource: 'api' | 'mock'
}> {
  const data = await runAgentBacktest(input)
  return {
    data,
    dataSource: getDataMode() === 'mock' ? 'mock' : 'api',
  }
}

export async function fetchAgentBacktestHistory(input: AgentBacktestHistoryInput): Promise<AgentBacktestHistoryResponse> {
  const data = await listAgentBacktestRuns(input)
  return ensureListResponse(data)
}

export async function fetchAgentBacktestRunDetail(runGroupId: number): Promise<AgentBacktestDetailResponse> {
  return await getAgentBacktestRunDetail(runGroupId)
}
