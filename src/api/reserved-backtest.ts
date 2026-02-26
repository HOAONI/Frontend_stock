import client from './client'
import { toCamelCase } from './case'

export interface ReservedBacktestCompareRequest {
  code?: string
  evalWindowDaysList: number[]
}

export interface ReservedBacktestCurvesResponse {
  scope: 'overall' | 'stock'
  code?: string
  evalWindowDays: number
  curves: Array<{
    label: string
    strategyReturnPct: number
    benchmarkReturnPct: number
    drawdownPct: number
  }>
}

export interface ReservedBacktestDistributionResponse {
  scope: 'overall' | 'stock'
  code?: string
  evalWindowDays: number
  distribution: {
    longCount: number
    cashCount: number
    winCount: number
    lossCount: number
    neutralCount: number
  }
}

export async function postReservedBacktestCompare(payload: ReservedBacktestCompareRequest): Promise<Record<string, unknown>> {
  const body = {
    code: payload.code,
    eval_window_days_list: payload.evalWindowDaysList,
  }
  const { data } = await client.post('/api/v1/backtest/compare', body)
  return toCamelCase<Record<string, unknown>>(data)
}

export async function getReservedBacktestCurves(scope: 'overall' | 'stock', code: string | undefined, evalWindowDays: number): Promise<ReservedBacktestCurvesResponse> {
  const { data } = await client.get('/api/v1/backtest/curves', {
    params: {
      scope,
      code,
      eval_window_days: evalWindowDays,
    },
  })
  return toCamelCase<ReservedBacktestCurvesResponse>(data)
}

export async function getReservedBacktestDistribution(scope: 'overall' | 'stock', code: string | undefined, evalWindowDays: number): Promise<ReservedBacktestDistributionResponse> {
  const { data } = await client.get('/api/v1/backtest/distribution', {
    params: {
      scope,
      code,
      eval_window_days: evalWindowDays,
    },
  })
  return toCamelCase<ReservedBacktestDistributionResponse>(data)
}

export function getReservedBacktestReportUrl(scope: 'overall' | 'stock', code: string | undefined, evalWindowDays: number, format: 'md' | 'json'): string {
  const query = new URLSearchParams({
    scope,
    eval_window_days: String(evalWindowDays),
    format,
  })
  if (code)
    query.set('code', code)
  return `/api/v1/backtest/report?${query.toString()}`
}
