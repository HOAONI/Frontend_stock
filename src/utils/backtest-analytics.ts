import type { BacktestResultItem, PerformanceMetrics } from '@/types/backtest'
import type { BacktestAnalyticsBundle, CurvePoint, TradeDistribution } from '@/types/backtest-analytics'

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric))
    return null
  return numeric
}

export function buildCurves(results: BacktestResultItem[]): CurvePoint[] {
  const completed = [...results]
    .filter(item => item.evalStatus === 'completed')
    .sort((a, b) => {
      const aTime = new Date(a.analysisDate || a.evaluatedAt).getTime()
      const bTime = new Date(b.analysisDate || b.evaluatedAt).getTime()
      return aTime - bTime
    })

  const curves: CurvePoint[] = []
  let strategyEquity = 1
  let benchmarkEquity = 1
  let peak = 1

  completed.forEach((item, index) => {
    const strategyReturn = asNumber(item.simulatedReturnPct) ?? 0
    const benchmarkReturn = asNumber(item.stockReturnPct) ?? 0
    strategyEquity *= (1 + strategyReturn / 100)
    benchmarkEquity *= (1 + benchmarkReturn / 100)

    if (strategyEquity > peak)
      peak = strategyEquity

    const drawdown = (strategyEquity / peak - 1) * 100

    curves.push({
      index: index + 1,
      label: item.analysisDate || item.evaluatedAt,
      strategyReturnPct: round((strategyEquity - 1) * 100),
      benchmarkReturnPct: round((benchmarkEquity - 1) * 100),
      drawdownPct: round(drawdown),
    })
  })

  return curves
}

export function buildDistribution(performance: PerformanceMetrics | null): TradeDistribution {
  return {
    positionDistribution: {
      longCount: Number(performance?.longCount ?? 0),
      cashCount: Number(performance?.cashCount ?? 0),
    },
    outcomeDistribution: {
      winCount: Number(performance?.winCount ?? 0),
      lossCount: Number(performance?.lossCount ?? 0),
      neutralCount: Number(performance?.neutralCount ?? 0),
    },
  }
}

export function maxDrawdown(curves: CurvePoint[]): number | null {
  if (curves.length === 0)
    return null
  return curves.reduce((min, item) => Math.min(min, item.drawdownPct), curves[0].drawdownPct)
}

export function buildAnalyticsBundle(results: BacktestResultItem[], performance: PerformanceMetrics | null): BacktestAnalyticsBundle {
  const curves = buildCurves(results)
  return {
    curves,
    distribution: buildDistribution(performance),
    maxDrawdownPct: maxDrawdown(curves),
  }
}
