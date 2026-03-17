/** 技术指标计算工具，负责从历史行情中派生均线、RSI、量比等指标。 */
import type { FactorSnapshot, MaSeriesPoint } from '@/types/market-analytics'
import type { StockHistoryPoint } from '@/types/stocks'

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function average(values: number[]): number | null {
  if (values.length === 0)
    return null
  return values.reduce((sum, item) => sum + item, 0) / values.length
}

function safeNumber(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isFinite(num))
    return null
  return num
}

/** 计算均线序列；当样本不足时返回 `null`，让图表明确表现为空档。 */
export function computeMA(bars: StockHistoryPoint[], window: number): MaSeriesPoint[] {
  return bars.map((bar, index) => {
    if (index + 1 < window) {
      return {
        date: bar.date,
        value: null,
      }
    }
    const range = bars.slice(index + 1 - window, index + 1)
    const closes = range.map(item => safeNumber(item.close)).filter((item): item is number => item != null)
    const ma = average(closes)
    return {
      date: bar.date,
      value: ma == null ? null : round(ma),
    }
  })
}

/** 按 14 周期 RSI 的常规公式计算强弱指标。 */
export function computeRSI14(bars: StockHistoryPoint[]): number | null {
  if (bars.length < 15)
    return null

  const closes = bars.map(item => Number(item.close))
  const deltas: number[] = []
  for (let i = 1; i < closes.length; i += 1)
    deltas.push(closes[i] - closes[i - 1])

  let gain = 0
  let loss = 0
  for (let i = 0; i < 14; i += 1) {
    const delta = deltas[i]
    if (delta >= 0)
      gain += delta
    else
      loss += Math.abs(delta)
  }

  let avgGain = gain / 14
  let avgLoss = loss / 14

  for (let i = 14; i < deltas.length; i += 1) {
    const delta = deltas[i]
    const currentGain = delta > 0 ? delta : 0
    const currentLoss = delta < 0 ? Math.abs(delta) : 0
    avgGain = (avgGain * 13 + currentGain) / 14
    avgLoss = (avgLoss * 13 + currentLoss) / 14
  }

  if (avgLoss === 0)
    return 100

  const rs = avgGain / avgLoss
  return round(100 - 100 / (1 + rs))
}

/** 计算最近 20 个交易周期的动量百分比。 */
export function computeMomentum20(bars: StockHistoryPoint[]): number | null {
  if (bars.length < 21)
    return null
  const current = Number(bars[bars.length - 1].close)
  const base = Number(bars[bars.length - 21].close)
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0)
    return null
  return round(((current / base) - 1) * 100)
}

/** 计算最近一根 K 线相对于近 5 根平均成交量的量比。 */
export function computeVolRatio5(bars: StockHistoryPoint[]): number | null {
  if (bars.length < 5)
    return null
  const last = bars[bars.length - 1]
  const currentVol = safeNumber(last.volume)
  if (currentVol == null)
    return null

  const range = bars.slice(-5)
  const vols = range.map(item => safeNumber(item.volume)).filter((item): item is number => item != null)
  const avgVol = average(vols)
  if (avgVol == null || avgVol === 0)
    return null

  return round(currentVol / avgVol)
}

/** 计算最新一根 K 线的振幅百分比。 */
export function computeAmplitude(bars: StockHistoryPoint[]): number | null {
  if (bars.length === 0)
    return null
  const last = bars[bars.length - 1]
  const open = Number(last.open)
  const high = Number(last.high)
  const low = Number(last.low)
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || open === 0)
    return null
  return round(((high - low) / open) * 100)
}

/** 汇总页面常用的行情派生因子，供行情中心统一消费。 */
export function computeFactors(bars: StockHistoryPoint[]): FactorSnapshot {
  const ma5 = computeMA(bars, 5)
  const ma10 = computeMA(bars, 10)
  const ma20 = computeMA(bars, 20)
  const ma60 = computeMA(bars, 60)

  return {
    ma5: ma5[ma5.length - 1]?.value ?? null,
    ma10: ma10[ma10.length - 1]?.value ?? null,
    ma20: ma20[ma20.length - 1]?.value ?? null,
    ma60: ma60[ma60.length - 1]?.value ?? null,
    rsi14: computeRSI14(bars),
    momentum20: computeMomentum20(bars),
    volRatio5: computeVolRatio5(bars),
    amplitude: computeAmplitude(bars),
  }
}
