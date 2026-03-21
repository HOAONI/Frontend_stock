/** 全局行情源选择相关类型定义。 */

export interface MarketSourceOption {
  code: string
  label: string
  description: string
  available: boolean
  reason?: string | null
}

export interface MarketSourceConfigResponse {
  currentSource: string
  options: MarketSourceOption[]
  updatedAt?: string | null
}

export interface UpdateMarketSourceRequest {
  source: string
}

export interface UpdateMarketSourceResponse {
  success: boolean
  currentSource: string
  updatedAt: string
  configVersion?: string
}
