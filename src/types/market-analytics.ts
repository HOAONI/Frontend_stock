/** 行情分析视图类型定义，描述均线、因子和分时数据结构。 */
import type { QuoteResponse, StockHistoryPoint } from './stocks'

export interface MaSeriesPoint {
  date: string
  value: number | null
}

export interface FactorSnapshot {
  ma5: number | null
  ma10: number | null
  ma20: number | null
  ma60: number | null
  rsi14: number | null
  momentum20: number | null
  volRatio5: number | null
  amplitude: number | null
}

export interface IntradayPoint {
  time: string
  price: number
}

export interface MarketViewModel {
  stockCode: string
  quote: QuoteResponse | null
  bars: StockHistoryPoint[]
  intraday: IntradayPoint[]
  maSeries: {
    ma5: MaSeriesPoint[]
    ma10: MaSeriesPoint[]
    ma20: MaSeriesPoint[]
    ma60: MaSeriesPoint[]
  }
  factors: FactorSnapshot
}
