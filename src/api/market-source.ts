/** 全局行情源选择接口封装。 */
import type {
  MarketSourceConfigResponse,
  UpdateMarketSourceRequest,
  UpdateMarketSourceResponse,
} from '@/types/market-source'
import client from './client'
import { toCamelCase } from './case'

export async function getMarketSourceConfig(): Promise<MarketSourceConfigResponse> {
  const { data } = await client.get('/api/v1/system/market-source')
  return toCamelCase<MarketSourceConfigResponse>(data)
}

export async function updateMarketSource(payload: UpdateMarketSourceRequest): Promise<UpdateMarketSourceResponse> {
  const { data } = await client.put('/api/v1/system/market-source', payload)
  return toCamelCase<UpdateMarketSourceResponse>(data)
}
