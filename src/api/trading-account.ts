/** 交易账户接口封装，负责资产快照、订单成交和入金请求。 */
import type {
  AddTradingFundsRequest,
  TradingAddFundsResponse,
  TradingOrdersResponse,
  TradingPerformanceResponse,
  TradingPositionsResponse,
  TradingQueryParams,
  TradingSummaryResponse,
  TradingTradesResponse,
} from '@/types/trading-account'
import client from './client'
import { toCamelCase } from './case'

/** 把交易账户查询参数转换成接口可识别的 query 对象。 */
function buildQuery(params: TradingQueryParams = {}): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  if (params.refresh != null)
    query.refresh = params.refresh
  return query
}

/** 获取交易账户的基础摘要与最新快照信息。 */
export async function getTradingAccountSummary(params: TradingQueryParams = {}): Promise<TradingSummaryResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/account-summary', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingSummaryResponse>(data)
}

/** 获取交易账户收益表现数据。 */
export async function getTradingPerformance(params: TradingQueryParams = {}): Promise<TradingPerformanceResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/performance', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingPerformanceResponse>(data)
}

/** 获取当前持仓列表。 */
export async function getTradingPositions(params: TradingQueryParams = {}): Promise<TradingPositionsResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/positions', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingPositionsResponse>(data)
}

/** 获取最近委托记录。 */
export async function getTradingOrders(params: TradingQueryParams = {}): Promise<TradingOrdersResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/orders', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingOrdersResponse>(data)
}

/** 获取最近成交记录。 */
export async function getTradingTrades(params: TradingQueryParams = {}): Promise<TradingTradesResponse> {
  const { data } = await client.get('/api/v1/users/me/trading/trades', {
    params: buildQuery(params),
  })
  return toCamelCase<TradingTradesResponse>(data)
}

/** 发起一笔模拟盘入金，并返回更新后的账户摘要与表现数据。 */
export async function addTradingFunds(payload: AddTradingFundsRequest): Promise<TradingAddFundsResponse> {
  const body: Record<string, unknown> = {
    amount: payload.amount,
  }
  if (payload.note !== undefined)
    body.note = payload.note

  const { data } = await client.post('/api/v1/users/me/trading/funds/add', body)
  return toCamelCase<TradingAddFundsResponse>(data)
}
