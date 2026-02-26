import { getStockHistory, getStockQuote } from '@/api/stocks'
import { getReservedFactors, getReservedIndicators } from '@/api/reserved-market'
import type { FactorSnapshot, IntradayPoint, MarketViewModel } from '@/types/market-analytics'
import type { StockHistoryPoint } from '@/types/stocks'
import { computeFactors, computeMA } from '@/utils/indicators'
import { getDataMode, getHttpStatus, isMissingApiStatus } from './data-source'
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

export async function fetchMarketBundle(stockCode: string, days: number): Promise<ServicePayload<MarketViewModel>> {
  const mode = getDataMode()
  const missingApis: string[] = []
  const warnings: string[] = []

  const [quote, history] = await Promise.all([
    mode === 'mock' ? Promise.resolve(null) : getStockQuote(stockCode),
    mode === 'mock' ? Promise.resolve({ data: [] as StockHistoryPoint[] }) : getStockHistory(stockCode, days),
  ])

  const bars = history.data || []
  let factors = computeFactors(bars)
  let source: 'api' | 'mock' | 'derived' = mode === 'mock' ? 'mock' : 'api'

  if (mode !== 'mock' && bars.length > 0) {
    const latestDate = bars[bars.length - 1].date
    try {
      const [indicatorsResp, factorsResp] = await Promise.all([
        getReservedIndicators(stockCode, days, [5, 10, 20, 60]),
        getReservedFactors(stockCode, latestDate),
      ])
      const latest = indicatorsResp.items[indicatorsResp.items.length - 1]
      if (latest?.mas) {
        factors = {
          ...factors,
          ma5: Number(latest.mas.ma5 ?? factors.ma5),
          ma10: Number(latest.mas.ma10 ?? factors.ma10),
          ma20: Number(latest.mas.ma20 ?? factors.ma20),
          ma60: Number(latest.mas.ma60 ?? factors.ma60),
          rsi14: Number(factorsResp.factors.rsi14 ?? factors.rsi14),
          momentum20: Number(factorsResp.factors.momentum20 ?? factors.momentum20),
          volRatio5: Number(factorsResp.factors.volRatio5 ?? factors.volRatio5),
          amplitude: Number(factorsResp.factors.amplitude ?? factors.amplitude),
        }
      }
    }
    catch (error: unknown) {
      const status = getHttpStatus(error)
      if (isMissingApiStatus(status)) {
        source = 'derived'
        missingApis.push('/api/v1/stocks/:code/indicators', '/api/v1/stocks/:code/factors')
        warnings.push('指标/因子接口未开放，已使用前端派生结果')
      }
      else {
        source = 'derived'
        warnings.push('指标/因子接口调用失败，已使用前端派生结果')
      }
    }
  }

  if (bars.length < 60)
    warnings.push('历史样本不足，部分指标可能为空')

  const intradaySeed: IntradayPoint[] = quote
    ? [{ time: nowLabel(), price: quote.currentPrice }]
    : []

  return {
    data: buildModel(stockCode, bars, quote, intradaySeed, bars.length > 0 ? factors : defaultFactors()),
    dataSource: source,
    missingApis,
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
