import { getBacktestResults, getOverallPerformance, runBacktest } from '@/api/backtest'
import {
  getReservedBacktestCurves,
  getReservedBacktestDistribution,
  postReservedBacktestCompare,
} from '@/api/reserved-backtest'
import type { BacktestResultItem, PerformanceMetrics } from '@/types/backtest'
import type { BacktestAnalyticsBundle, StrategyCompareItem } from '@/types/backtest-analytics'
import { buildAnalyticsBundle, maxDrawdown } from '@/utils/backtest-analytics'
import { getDataMode, getHttpStatus, isMissingApiStatus } from './data-source'
import type { ServicePayload } from './data-source'

export interface BacktestBundle {
  results: BacktestResultItem[]
  total: number
  page: number
  limit: number
  overall: PerformanceMetrics | null
  analytics: BacktestAnalyticsBundle
}

export async function fetchBacktestBundle(input: {
  code?: string
  evalWindowDays?: number
  page?: number
  limit?: number
}): Promise<ServicePayload<BacktestBundle>> {
  const mode = getDataMode()
  const missingApis: string[] = []
  const warnings: string[] = []

  const page = input.page || 1
  const limit = input.limit || 20

  const [resultsResp, overall] = await Promise.all([
    getBacktestResults({
      code: input.code,
      evalWindowDays: input.evalWindowDays,
      page,
      limit,
    }),
    getOverallPerformance(input.evalWindowDays),
  ])

  let analytics = buildAnalyticsBundle(resultsResp.items, overall)
  let source: 'api' | 'mock' | 'derived' = mode === 'mock' ? 'mock' : 'api'

  if (mode !== 'mock') {
    try {
      const scope = input.code ? 'stock' : 'overall'
      const code = input.code
      const window = Number(input.evalWindowDays ?? 10)
      const [curvesResp, distributionResp] = await Promise.all([
        getReservedBacktestCurves(scope, code, window),
        getReservedBacktestDistribution(scope, code, window),
      ])
      analytics = {
        curves: curvesResp.curves.map((item, index) => ({
          index: index + 1,
          label: item.label,
          strategyReturnPct: item.strategyReturnPct,
          benchmarkReturnPct: item.benchmarkReturnPct,
          drawdownPct: item.drawdownPct,
        })),
        distribution: distributionResp.distribution,
        maxDrawdownPct: maxDrawdown(curvesResp.curves.map((item, index) => ({
          index,
          label: item.label,
          strategyReturnPct: item.strategyReturnPct,
          benchmarkReturnPct: item.benchmarkReturnPct,
          drawdownPct: item.drawdownPct,
        }))),
      }
    }
    catch (error: unknown) {
      const status = getHttpStatus(error)
      source = 'derived'
      if (isMissingApiStatus(status)) {
        missingApis.push('/api/v1/backtest/curves', '/api/v1/backtest/distribution')
        warnings.push('曲线/分布接口未开放，已使用前端派生结果')
      }
      else {
        warnings.push('曲线/分布接口调用失败，已使用前端派生结果')
      }
    }
  }

  return {
    data: {
      results: resultsResp.items,
      total: resultsResp.total,
      page: resultsResp.page,
      limit: resultsResp.limit,
      overall,
      analytics,
    },
    dataSource: source,
    missingApis,
    warnings,
  }
}

export async function runBacktestWithRefresh(input: {
  code?: string
  force?: boolean
  evalWindowDays?: number
}): Promise<ServicePayload<{ summary: Awaited<ReturnType<typeof runBacktest>> }>> {
  const summary = await runBacktest({
    code: input.code,
    force: input.force,
    evalWindowDays: input.evalWindowDays,
    minAgeDays: input.force ? 0 : undefined,
  })
  return {
    data: { summary },
    dataSource: 'api',
    missingApis: [],
    warnings: [],
  }
}

export async function compareStrategies(code: string | undefined, evalWindowDaysList: number[]): Promise<ServicePayload<StrategyCompareItem[]>> {
  const mode = getDataMode()
  const missingApis: string[] = []
  const warnings: string[] = []

  if (mode !== 'mock') {
    try {
      const result = await postReservedBacktestCompare({ code, evalWindowDaysList })
      if (Array.isArray(result.items)) {
        return {
          data: result.items as StrategyCompareItem[],
          dataSource: 'api',
          missingApis,
          warnings,
        }
      }
    }
    catch (error: unknown) {
      const status = getHttpStatus(error)
      if (isMissingApiStatus(status)) {
        missingApis.push('/api/v1/backtest/compare')
        warnings.push('策略对比接口未开放，已使用前端并行回测')
      }
      else {
        warnings.push('策略对比接口调用失败，已使用前端并行回测')
      }
    }
  }

  const items: StrategyCompareItem[] = []
  for (const window of evalWindowDaysList) {
    await runBacktest({
      code,
      evalWindowDays: window,
      force: false,
      minAgeDays: 0,
    })

    const perf = await getOverallPerformance(window)
    const resultRows = await getBacktestResults({
      code,
      evalWindowDays: window,
      page: 1,
      limit: 200,
    })
    const analytics = buildAnalyticsBundle(resultRows.items, perf)

    items.push({
      evalWindowDays: window,
      totalEvaluations: Number(perf?.totalEvaluations ?? 0),
      completedCount: Number(perf?.completedCount ?? 0),
      directionAccuracyPct: perf?.directionAccuracyPct ?? null,
      winRatePct: perf?.winRatePct ?? null,
      avgSimulatedReturnPct: perf?.avgSimulatedReturnPct ?? null,
      avgStockReturnPct: perf?.avgStockReturnPct ?? null,
      maxDrawdownPct: analytics.maxDrawdownPct,
      dataSource: mode === 'mock' ? 'mock' : 'derived',
    })
  }

  return {
    data: items,
    dataSource: mode === 'mock' ? 'mock' : 'derived',
    missingApis,
    warnings,
  }
}
