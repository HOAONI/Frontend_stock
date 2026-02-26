export interface QuoteResponse {
  stockCode: string
  stockName: string
  currentPrice: number
  change?: number | null
  changePercent?: number | null
  open?: number | null
  high?: number | null
  low?: number | null
  prevClose?: number | null
  volume?: number | null
  amount?: number | null
  updateTime: string
}

export interface StockHistoryPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
  amount?: number | null
  changePercent?: number | null
}

export interface StockHistoryResponse {
  stockCode: string
  stockName: string
  period: 'daily'
  data: StockHistoryPoint[]
}

export interface ExtractFromImageResponse {
  codes: string[]
  rawText?: string | null
}
