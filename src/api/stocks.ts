/** 股票行情接口封装，负责报价、历史 K 线和图片识股请求。 */
import type { ExtractFromImageResponse, QuoteResponse, StockHistoryResponse } from '@/types/stocks'
import client from './client'
import { toCamelCase } from './case'

export async function getStockQuote(stockCode: string): Promise<QuoteResponse> {
  const { data } = await client.get(`/api/v1/stocks/${encodeURIComponent(stockCode)}/quote`)
  return toCamelCase<QuoteResponse>(data)
}

export async function getStockHistory(stockCode: string, days: number): Promise<StockHistoryResponse> {
  const { data } = await client.get(`/api/v1/stocks/${encodeURIComponent(stockCode)}/history`, {
    params: {
      period: 'daily',
      days,
    },
  })
  return toCamelCase<StockHistoryResponse>(data)
}

export async function extractStockCodesFromImage(file: File): Promise<ExtractFromImageResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await client.post('/api/v1/stocks/extract-from-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  })

  return toCamelCase<ExtractFromImageResponse>(data)
}
