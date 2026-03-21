import { getStockHistory, getStockQuote } from '@/api/stocks'
import { getReservedFactors, getReservedIndicators } from '@/api/reserved-market'
import type { FactorSnapshot, IntradayPoint, MarketViewModel } from '@/types/market-analytics'
import type { StockHistoryPoint } from '@/types/stocks'
import { computeMA } from '@/utils/indicators'
import { getDataMode } from './data-source'
import type { ServicePayload } from './data-source'

function nowLabel(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

function defaultFactors(): FactorSnapshot {
  return {
    ma5: null,
    ma10: null,
    ma20: null,
    ma60: null,
    rsi14: null,
    momentum20: null,
    volRatio5: null,
    amplitude: null,
  }
}

function normalizeFactorValue(value: unknown): number | null {
  if (value == null || value === '')
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildModel(stockCode: string, bars: StockHistoryPoint[], quote: Awaited<ReturnType<typeof getStockQuote>> | null, intraday: IntradayPoint[], factors: FactorSnapshot): MarketViewModel {
  return {
    stockCode,
    quote,
    bars,
    intraday,
    maSeries: {
      ma5: computeMA(bars, 5),
      ma10: computeMA(bars, 10),
      ma20: computeMA(bars, 20),
      ma60: computeMA(bars, 60),
    },
    factors,
  }
}

// 行情中心统一消费后端“当前全局行情源”接口，确保 quote / history / indicators / factors 口径一致。
export async function fetchMarketBundle(stockCode: string, days: number): Promise<ServicePayload<MarketViewModel>> {
  const mode = getDataMode()
  const warnings: string[] = []

  const [quote, history] = await Promise.all([
    mode === 'mock' ? Promise.resolve(null) : getStockQuote(stockCode),
    mode === 'mock' ? Promise.resolve({ data: [] as StockHistoryPoint[] }) : getStockHistory(stockCode, days),
  ])

  const bars = history.data || []
  let factors = defaultFactors()
  const source: 'api' | 'mock' | 'derived' = mode === 'mock' ? 'mock' : 'api'

  if (mode !== 'mock' && bars.length > 0) {
    const latestDate = bars[bars.length - 1].date
    const [indicatorsResp, factorsResp] = await Promise.all([
      getReservedIndicators(stockCode, days, [5, 10, 20, 60]),
      getReservedFactors(stockCode, latestDate),
    ])
    const latest = indicatorsResp.items[indicatorsResp.items.length - 1]
    if (latest?.mas) {
      factors = {
        ma5: normalizeFactorValue(latest.mas.ma5),
        ma10: normalizeFactorValue(latest.mas.ma10),
        ma20: normalizeFactorValue(latest.mas.ma20),
        ma60: normalizeFactorValue(latest.mas.ma60),
        rsi14: normalizeFactorValue(factorsResp.factors.rsi14),
        momentum20: normalizeFactorValue(factorsResp.factors.momentum20),
        volRatio5: normalizeFactorValue(factorsResp.factors.volRatio5),
        amplitude: normalizeFactorValue(factorsResp.factors.amplitude),
      }
    }
  }

  // MA60 等指标至少需要一定样本，样本不足时让前端明确给出提示而不是静默异常。
  if (bars.length < 60)
    warnings.push('历史样本不足，部分指标可能为空')

  const intradaySeed: IntradayPoint[] = quote
    ? [{ time: nowLabel(), price: quote.currentPrice }]
    : []

  return {
    data: buildModel(stockCode, bars, quote, intradaySeed, bars.length > 0 ? factors : defaultFactors()),
    dataSource: source,
    missingApis: [],
    warnings,
  }
}

export async function fetchQuoteOnly(stockCode: string): Promise<ServicePayload<{ quote: Awaited<ReturnType<typeof getStockQuote>> | null, point: IntradayPoint | null }>> {
  const mode = getDataMode()
  if (mode === 'mock') {
    return {
      data: {
        quote: null,
        point: null,
      },
      dataSource: 'mock',
      missingApis: [],
      warnings: ['当前为 mock 模式，未请求实时行情接口'],
    }
  }

  const quote = await getStockQuote(stockCode)
  return {
    data: {
      quote,
      point: { time: nowLabel(), price: quote.currentPrice },
    },
    dataSource: 'api',
    missingApis: [],
    warnings: [],
  }
}
