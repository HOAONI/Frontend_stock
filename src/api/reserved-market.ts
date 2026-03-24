/** 行情预留接口封装，负责读取后端指标和因子数据。 */
import client from './client'
import { toCamelCase } from './case'

export interface ReservedIndicatorsResponse {
  stockCode: string
  period: 'daily'
  days: number
  windows: number[]
  source?: string
  requestedSource?: string
  warning?: string
  items: Array<{
    date: string
    close: number
    mas: Record<string, number | null>
  }>
}

export interface ReservedFactorsResponse {
  stockCode: string
  date: string
  source?: string
  requestedSource?: string
  warning?: string
  factors: Record<string, number | string | null>
}

export async function getReservedIndicators(stockCode: string, days: number, windows: number[]): Promise<ReservedIndicatorsResponse> {
  const { data } = await client.get(`/api/v1/stocks/${encodeURIComponent(stockCode)}/indicators`, {
    params: {
      period: 'daily',
      days,
      windows: windows.join(','),
    },
  })
  return toCamelCase<ReservedIndicatorsResponse>(data)
}

export async function getReservedFactors(stockCode: string, date: string): Promise<ReservedFactorsResponse> {
  const { data } = await client.get(`/api/v1/stocks/${encodeURIComponent(stockCode)}/factors`, {
    params: { date },
  })
  return toCamelCase<ReservedFactorsResponse>(data)
}
