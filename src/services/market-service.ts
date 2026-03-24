import { getStockHistory, getStockQuote } from '@/api/stocks'
import { getReservedFactors, getReservedIndicators } from '@/api/reserved-market'
import type { FactorSnapshot, IntradayPoint, MarketSourceMeta, MarketViewModel } from '@/types/market-analytics'
import type { StockHistoryPoint, StockHistoryResponse } from '@/types/stocks'
import { computeFactors, computeMA } from '@/utils/indicators'
import { getDataMode, getErrorMessage, getHttpStatus, isMissingApiStatus } from './data-source'
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

function pushUniqueWarning(target: string[], warning: string | null | undefined) {
  const text = String(warning || '').trim()
  if (text && !target.includes(text))
    target.push(text)
}

function pushMissingApi(target: string[], apiName: string) {
  if (!target.includes(apiName))
    target.push(apiName)
}

function defaultSourceMeta(): MarketSourceMeta {
  return {
    source: null,
    requestedSource: null,
    warning: null,
  }
}

function extractSourceMeta(payload: { source?: string | null, requestedSource?: string | null, warning?: string | null } | null | undefined): MarketSourceMeta {
  return {
    source: payload?.source ? String(payload.source) : null,
    requestedSource: payload?.requestedSource ? String(payload.requestedSource) : null,
    warning: payload?.warning ? String(payload.warning) : null,
  }
}

function preferFactorValue(primary: unknown, fallback: number | null): number | null {
  const normalized = normalizeFactorValue(primary)
  return normalized == null ? fallback : normalized
}

function buildModel(
  stockCode: string,
  bars: StockHistoryPoint[],
  quote: Awaited<ReturnType<typeof getStockQuote>> | null,
  intraday: IntradayPoint[],
  factors: FactorSnapshot,
  historySourceMeta: MarketSourceMeta,
  historyError: string | null,
): MarketViewModel {
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
    historySourceMeta,
    historyError,
  }
}

// 行情中心统一消费后端“当前全局行情源”接口，确保 quote / history / indicators / factors 口径一致。
export async function fetchMarketBundle(stockCode: string, days: number): Promise<ServicePayload<MarketViewModel>> {
  const mode = getDataMode()
  const warnings: string[] = []
  const missingApis: string[] = []
  const mockHistoryResponse: StockHistoryResponse = {
    stockCode,
    stockName: stockCode,
    period: 'daily',
    data: [],
  }

  const [quoteResult, historyResult] = await Promise.allSettled([
    mode === 'mock' ? Promise.resolve(null) : getStockQuote(stockCode),
    mode === 'mock' ? Promise.resolve(mockHistoryResponse) : getStockHistory(stockCode, days),
  ])

  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null

  if (quoteResult.status === 'rejected')
    pushUniqueWarning(warnings, `实时行情暂不可用，已保留历史与指标数据：${getErrorMessage(quoteResult.reason, '请求失败')}`)
  else
    pushUniqueWarning(warnings, quote?.warning)

  let bars: StockHistoryPoint[] = []
  let historySourceMeta = defaultSourceMeta()
  let historyError: string | null = null

  if (historyResult.status === 'fulfilled') {
    bars = historyResult.value.data || []
    historySourceMeta = extractSourceMeta(historyResult.value)
    pushUniqueWarning(warnings, historyResult.value.warning)
    if (bars.length === 0) {
      historyError = '历史日线接口返回空数据，K 线/MA 未显示'
      pushUniqueWarning(warnings, historyError)
    }
  }
  else {
    const message = getErrorMessage(historyResult.reason, '请求失败')
    historyError = `历史日线暂不可用，因此 K 线/MA 未显示：${message}`
    if (isMissingApiStatus(getHttpStatus(historyResult.reason)))
      pushMissingApi(missingApis, 'history')
    pushUniqueWarning(warnings, historyError)
  }

  let factors = bars.length > 0 ? computeFactors(bars) : defaultFactors()
  const source: 'api' | 'mock' | 'derived' = mode === 'mock' ? 'mock' : 'api'

  if (mode !== 'mock' && bars.length > 0) {
    const latestDate = bars[bars.length - 1].date
    const [indicatorsResult, factorsResult] = await Promise.allSettled([
      getReservedIndicators(stockCode, days, [5, 10, 20, 60]),
      getReservedFactors(stockCode, latestDate),
    ])

    if (indicatorsResult.status === 'fulfilled') {
      const indicatorsResp = indicatorsResult.value
      pushUniqueWarning(warnings, indicatorsResp.warning)
      const latest = indicatorsResp.items[indicatorsResp.items.length - 1]
      if (latest?.mas) {
        factors = {
          ...factors,
          ma5: preferFactorValue(latest.mas.ma5, factors.ma5),
          ma10: preferFactorValue(latest.mas.ma10, factors.ma10),
          ma20: preferFactorValue(latest.mas.ma20, factors.ma20),
          ma60: preferFactorValue(latest.mas.ma60, factors.ma60),
        }
      }
    }
    else {
      if (isMissingApiStatus(getHttpStatus(indicatorsResult.reason)))
        pushMissingApi(missingApis, 'indicators')
      pushUniqueWarning(warnings, `指标接口暂不可用，已改用历史日线本地派生均线：${getErrorMessage(indicatorsResult.reason, '请求失败')}`)
    }

    if (factorsResult.status === 'fulfilled') {
      const factorsResp = factorsResult.value
      pushUniqueWarning(warnings, factorsResp.warning)
      factors = {
        ...factors,
        rsi14: preferFactorValue(factorsResp.factors.rsi14, factors.rsi14),
        momentum20: preferFactorValue(factorsResp.factors.momentum20, factors.momentum20),
        volRatio5: preferFactorValue(factorsResp.factors.volRatio5, factors.volRatio5),
        amplitude: preferFactorValue(factorsResp.factors.amplitude, factors.amplitude),
      }
    }
    else {
      if (isMissingApiStatus(getHttpStatus(factorsResult.reason)))
        pushMissingApi(missingApis, 'factors')
      pushUniqueWarning(warnings, `因子接口暂不可用，已改用历史日线本地派生因子：${getErrorMessage(factorsResult.reason, '请求失败')}`)
    }
  }

  // MA60 等指标至少需要一定样本，样本不足时让前端明确给出提示而不是静默异常。
  if (bars.length < 60)
    pushUniqueWarning(warnings, '历史样本不足，部分指标可能为空')

  const intradaySeed: IntradayPoint[] = quote
    ? [{ time: nowLabel(), price: quote.currentPrice }]
    : []

  return {
    data: buildModel(
      stockCode,
      bars,
      quote,
      intradaySeed,
      bars.length > 0 ? factors : defaultFactors(),
      historySourceMeta,
      historyError,
    ),
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
  const warnings = quote.warning ? [quote.warning] : []
  return {
    data: {
      quote,
      point: { time: nowLabel(), price: quote.currentPrice },
    },
    dataSource: 'api',
    missingApis: [],
    warnings,
  }
}
