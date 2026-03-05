import { getBacktestResults, getOverallPerformance, getStockPerformance, runBacktest } from '@/api/backtest'
import {
  getReservedBacktestCurves,
  getReservedBacktestDistribution,
  postReservedBacktestCompare,
} from '@/api/reserved-backtest'
import type { BacktestResultItem, PerformanceMetrics } from '@/types/backtest'
import {
  DEFAULT_STRATEGY_COMPARE_CODES,
  STRATEGY_COMPARE_CODES,
  STRATEGY_COMPARE_NAME_MAP,
} from '@/types/backtest-analytics'
import type { BacktestAnalyticsBundle, StrategyCompareCode, StrategyCompareItem } from '@/types/backtest-analytics'
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
  const resolvedWindow = Number(input.evalWindowDays ?? 10)
  const normalizedCode = input.code?.trim() || undefined

  const [resultsResp, overall] = await Promise.all([
    getBacktestResults({
      code: normalizedCode,
      evalWindowDays: resolvedWindow,
      page,
      limit,
    }),
    normalizedCode ? getStockPerformance(normalizedCode, resolvedWindow) : getOverallPerformance(resolvedWindow),
  ])

  let analytics = buildAnalyticsBundle(resultsResp.items, overall)
  let source: 'api' | 'mock' | 'derived' = mode === 'mock' ? 'mock' : 'api'

  if (mode !== 'mock') {
    try {
      const scope = normalizedCode ? 'stock' : 'overall'
      const code = normalizedCode
      const window = resolvedWindow
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
        distribution: {
          positionDistribution: {
            longCount: Number(distributionResp.distribution.positionDistribution?.longCount ?? distributionResp.distribution.longCount ?? 0),
            cashCount: Number(distributionResp.distribution.positionDistribution?.cashCount ?? distributionResp.distribution.cashCount ?? 0),
          },
          outcomeDistribution: {
            winCount: Number(distributionResp.distribution.outcomeDistribution?.winCount ?? distributionResp.distribution.winCount ?? 0),
            lossCount: Number(distributionResp.distribution.outcomeDistribution?.lossCount ?? distributionResp.distribution.lossCount ?? 0),
            neutralCount: Number(distributionResp.distribution.outcomeDistribution?.neutralCount ?? distributionResp.distribution.neutralCount ?? 0),
          },
        },
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
  })
  return {
    data: { summary },
    dataSource: 'api',
    missingApis: [],
    warnings: [],
  }
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function normalizeStrategyCodes(strategyCodes?: StrategyCompareCode[]): StrategyCompareCode[] {
  const selected = strategyCodes && strategyCodes.length > 0 ? strategyCodes : DEFAULT_STRATEGY_COMPARE_CODES
  const normalized = Array.from(new Set(selected.filter(code => STRATEGY_COMPARE_CODES.includes(code))))
  return normalized.length > 0 ? normalized : [...DEFAULT_STRATEGY_COMPARE_CODES]
}

function normalizeWindows(evalWindowDaysList: number[]): number[] {
  return Array.from(
    new Set(
      evalWindowDaysList
        .map(item => Math.trunc(Number(item)))
        .filter(item => Number.isFinite(item) && item > 0 && item <= 120),
    ),
  ).sort((a, b) => a - b)
}

function toStrategyCompareItem(raw: Record<string, unknown>, fallbackDataSource: StrategyCompareItem['dataSource']): StrategyCompareItem | null {
  const strategyCode = String(raw.strategyCode ?? raw.strategy_code ?? '').trim() as StrategyCompareCode
  if (!STRATEGY_COMPARE_CODES.includes(strategyCode))
    return null
  const evalWindowDays = Number(raw.evalWindowDays ?? raw.eval_window_days)
  if (!Number.isFinite(evalWindowDays) || evalWindowDays <= 0)
    return null

  const predictionWinRatePct = Number(raw.predictionWinRatePct ?? raw.prediction_win_rate_pct)
  const tradeWinRatePct = Number(raw.tradeWinRatePct ?? raw.trade_win_rate_pct)
  const winRatePct = Number(raw.winRatePct ?? raw.win_rate_pct)
  const directionAccuracyPct = Number(raw.directionAccuracyPct ?? raw.direction_accuracy_pct)
  const avgSimulatedReturnPct = Number(raw.avgSimulatedReturnPct ?? raw.avg_simulated_return_pct)
  const avgStockReturnPct = Number(raw.avgStockReturnPct ?? raw.avg_stock_return_pct)
  const maxDrawdownPct = Number(raw.maxDrawdownPct ?? raw.max_drawdown_pct)

  return {
    strategyCode,
    strategyName: String(raw.strategyName ?? raw.strategy_name ?? STRATEGY_COMPARE_NAME_MAP[strategyCode]),
    evalWindowDays: Math.trunc(evalWindowDays),
    totalEvaluations: Number(raw.totalEvaluations ?? raw.total_evaluations ?? 0),
    completedCount: Number(raw.completedCount ?? raw.completed_count ?? 0),
    directionAccuracyPct: Number.isFinite(directionAccuracyPct) ? directionAccuracyPct : null,
    predictionWinRatePct: Number.isFinite(predictionWinRatePct) ? predictionWinRatePct : (Number.isFinite(winRatePct) ? winRatePct : null),
    tradeWinRatePct: Number.isFinite(tradeWinRatePct) ? tradeWinRatePct : null,
    winRatePct: Number.isFinite(winRatePct) ? winRatePct : (Number.isFinite(predictionWinRatePct) ? predictionWinRatePct : null),
    avgSimulatedReturnPct: Number.isFinite(avgSimulatedReturnPct) ? avgSimulatedReturnPct : null,
    avgStockReturnPct: Number.isFinite(avgStockReturnPct) ? avgStockReturnPct : null,
    maxDrawdownPct: Number.isFinite(maxDrawdownPct) ? maxDrawdownPct : null,
    dataSource: (raw.dataSource ?? raw.data_source ?? fallbackDataSource) as StrategyCompareItem['dataSource'],
  }
}

async function fetchAllBacktestResults(input: {
  code?: string
  evalWindowDays: number
}): Promise<{ items: BacktestResultItem[], total: number }> {
  const pageSize = 200
  let page = 1
  let total = 0
  const rows: BacktestResultItem[] = []
  while (page === 1 || rows.length < total) {
    const response = await getBacktestResults({
      code: input.code,
      evalWindowDays: input.evalWindowDays,
      page,
      limit: pageSize,
    })
    total = Number(response.total ?? 0)
    rows.push(...response.items)
    if (response.items.length === 0)
      break
    page += 1
  }
  return { items: rows, total }
}

function extractCompletedStockReturns(items: BacktestResultItem[]): number[] {
  return items
    .filter(item => item.evalStatus === 'completed' && item.stockReturnPct != null && Number.isFinite(item.stockReturnPct))
    .map(item => Number(item.stockReturnPct))
}

function average(values: number[]): number | null {
  if (values.length === 0)
    return null
  return round4(values.reduce((sum, item) => sum + item, 0) / values.length)
}

export async function compareStrategies(
  code: string | undefined,
  evalWindowDaysList: number[],
  strategyCodes: StrategyCompareCode[] = DEFAULT_STRATEGY_COMPARE_CODES,
): Promise<ServicePayload<StrategyCompareItem[]>> {
  const mode = getDataMode()
  const missingApis: string[] = []
  const warnings: string[] = []
  const normalizedWindows = normalizeWindows(evalWindowDaysList)
  const normalizedStrategyCodes = normalizeStrategyCodes(strategyCodes)
  if (normalizedWindows.length === 0 || normalizedStrategyCodes.length === 0) {
    return {
      data: [],
      dataSource: mode === 'mock' ? 'mock' : 'derived',
      missingApis,
      warnings,
    }
  }

  if (mode !== 'mock') {
    try {
      const result = await postReservedBacktestCompare({ code, evalWindowDaysList: normalizedWindows, strategyCodes: normalizedStrategyCodes })
      if (Array.isArray(result.items)) {
        const items = result.items
          .map(item => toStrategyCompareItem(item, 'api'))
          .filter((item): item is StrategyCompareItem => item != null)
        return {
          data: items,
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
        warnings.push('策略对比接口未开放，仅展示 Agent v1（其余策略不可比）')
      }
      else {
        if (!missingApis.includes('/api/v1/backtest/compare'))
          missingApis.push('/api/v1/backtest/compare')
        warnings.push('策略对比接口调用失败，仅展示 Agent v1（其余策略不可比）')
      }
    }
  }

  const items: StrategyCompareItem[] = []
  const fallbackStrategies = normalizedStrategyCodes.includes('agent_v1') ? ['agent_v1' as const] : []
  for (const window of normalizedWindows) {
    await runBacktest({
      code,
      evalWindowDays: window,
      force: false,
    })

    const perf = code ? await getStockPerformance(code, window) : await getOverallPerformance(window)
    const resultRows = await fetchAllBacktestResults({
      code,
      evalWindowDays: window,
    })
    const analytics = buildAnalyticsBundle(resultRows.items, perf)

    fallbackStrategies.forEach((strategyCode) => {
      items.push({
        strategyCode,
        strategyName: STRATEGY_COMPARE_NAME_MAP[strategyCode],
        evalWindowDays: window,
        totalEvaluations: Number(perf?.totalEvaluations ?? resultRows.total ?? resultRows.items.length),
        completedCount: Number(perf?.completedCount ?? extractCompletedStockReturns(resultRows.items).length),
        directionAccuracyPct: perf?.directionAccuracyPct ?? null,
        predictionWinRatePct: perf?.predictionWinRatePct ?? perf?.winRatePct ?? null,
        tradeWinRatePct: perf?.tradeWinRatePct ?? null,
        winRatePct: perf?.winRatePct ?? perf?.predictionWinRatePct ?? null,
        avgSimulatedReturnPct: perf?.avgSimulatedReturnPct ?? null,
        avgStockReturnPct: perf?.avgStockReturnPct ?? average(extractCompletedStockReturns(resultRows.items)),
        maxDrawdownPct: analytics.maxDrawdownPct,
        dataSource: mode === 'mock' ? 'mock' : 'derived',
      })
    })
  }

  return {
    data: items,
    dataSource: mode === 'mock' ? 'mock' : 'derived',
    missingApis,
    warnings,
  }
}
