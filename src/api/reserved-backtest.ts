import client from './client'
import { toCamelCase } from './case'
import type { StrategyCompareCode } from '@/types/backtest-analytics'

export interface ReservedBacktestCompareRequest {
  code?: string
  evalWindowDaysList: number[]
  strategyCodes?: StrategyCompareCode[]
}

export interface ReservedBacktestCurvesResponse {
  scope: 'overall' | 'stock'
  code?: string
  evalWindowDays: number
  equityMode?: 'portfolio' | 'sequential'
  metricDefinitionVersion?: string
  curves: Array<{
    label: string
    strategyReturnPct: number
    benchmarkReturnPct: number
    drawdownPct: number
  }>
  signalCurves?: Array<{
    label: string
    strategyReturnPct: number
    benchmarkReturnPct: number
    drawdownPct: number
  }>
  portfolioCurves?: Array<{
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
  metricDefinitionVersion?: string
  distribution: {
    positionDistribution: {
      longCount: number
      cashCount: number
    }
    outcomeDistribution: {
      winCount: number
      lossCount: number
      neutralCount: number
    }
    longCount?: number
    cashCount?: number
    winCount?: number
    lossCount?: number
    neutralCount?: number
  }
}

export interface ReservedBacktestCompareResponse {
  metricDefinitionVersion?: string
  items: Array<Record<string, unknown>>
}

export async function postReservedBacktestCompare(payload: ReservedBacktestCompareRequest): Promise<ReservedBacktestCompareResponse> {
  const body: Record<string, unknown> = {
    code: payload.code,
    eval_window_days_list: payload.evalWindowDaysList,
  }
  if (payload.strategyCodes && payload.strategyCodes.length > 0)
    body.strategy_codes = payload.strategyCodes

  const { data } = await client.post('/api/v1/backtest/compare', body)
  return toCamelCase<ReservedBacktestCompareResponse>(data)
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
