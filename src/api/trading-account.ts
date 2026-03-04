import type {
  TradingOrdersResponse,
  TradingPerformanceResponse,
  TradingPositionsResponse,
  TradingQueryParams,
  TradingSummaryResponse,
  TradingTradesResponse,
} from '@/types/trading-account'
import client from './client'
import { toCamelCase } from './case'

function buildQuery(params: TradingQueryParams = {}): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  if (params.refresh != null)
    query.refresh = params.refresh
  return query
}

export async function getTradingAccountSummary(params: TradingQueryParams = {}): Promise<TradingSummaryResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/account-summary', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingSummaryResponse>(data)
}

export async function getTradingPerformance(params: TradingQueryParams = {}): Promise<TradingPerformanceResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/performance', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingPerformanceResponse>(data)
}

export async function getTradingPositions(params: TradingQueryParams = {}): Promise<TradingPositionsResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/positions', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingPositionsResponse>(data)
}

export async function getTradingOrders(params: TradingQueryParams = {}): Promise<TradingOrdersResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/orders', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingOrdersResponse>(data)
}

export async function getTradingTrades(params: TradingQueryParams = {}): Promise<TradingTradesResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/trades', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingTradesResponse>(data)
}
