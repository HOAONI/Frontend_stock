import type {
  BacktestResultsResponse,
  BacktestRunRequest,
  BacktestRunResponse,
  PerformanceMetrics,
} from '@/types/backtest'
import client from './client'
import { toCamelCase } from './case'

export async function runBacktest(payload: BacktestRunRequest): Promise<BacktestRunResponse> {
  const body: Record<string, unknown> = {}
  if (payload.code)
    body.code = payload.code
  if (payload.force != null)
    body.force = payload.force
  if (payload.evalWindowDays != null)
    body.eval_window_days = payload.evalWindowDays
  if (payload.minAgeDays != null)
    body.min_age_days = payload.minAgeDays
  if (payload.limit != null)
    body.limit = payload.limit

  const { data } = await client.post('/api/v1/backtest/run', body)
  return toCamelCase<BacktestRunResponse>(data)
}

export async function getBacktestResults(params: {
  code?: string
  evalWindowDays?: number
  page?: number
  limit?: number
} = {}): Promise<BacktestResultsResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }
  if (params.code)
    query.code = params.code
  if (params.evalWindowDays != null)
    query.eval_window_days = params.evalWindowDays

  const { data } = await client.get('/api/v1/backtest/results', { params: query })
  return toCamelCase<BacktestResultsResponse>(data)
}

export async function getOverallPerformance(evalWindowDays?: number): Promise<PerformanceMetrics | null> {
  try {
    const { data } = await client.get('/api/v1/backtest/performance', {
      params: evalWindowDays ? { eval_window_days: evalWindowDays } : undefined,
    })
    return toCamelCase<PerformanceMetrics>(data)
  }
  catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 404)
      return null
    throw error
  }
}

export async function getStockPerformance(code: string, evalWindowDays?: number): Promise<PerformanceMetrics | null> {
  try {
    const { data } = await client.get(`/api/v1/backtest/performance/${encodeURIComponent(code)}`, {
      params: evalWindowDays ? { eval_window_days: evalWindowDays } : undefined,
    })
    return toCamelCase<PerformanceMetrics>(data)
  }
  catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 404)
      return null
    throw error
  }
}
