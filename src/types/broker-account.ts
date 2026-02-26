export type BrokerAccountStatus = 'active' | 'disabled'
export type BrokerEnvironment = 'paper'

export interface BrokerAccountItem {
  id: number
  brokerCode: string
  environment: BrokerEnvironment | string
  accountUid: string
  accountDisplayName: string | null
  status: BrokerAccountStatus
  isVerified: boolean
  lastVerifiedAt: string | null
  credentialsMasked: boolean
  createdAt: string
  updatedAt: string
}

export interface BrokerAccountListResponse {
  total: number
  items: BrokerAccountItem[]
}

export interface CreateBrokerAccountRequest {
  brokerCode: string
  environment?: BrokerEnvironment
  accountUid: string
  accountDisplayName?: string
  credentials: Record<string, unknown>
}

export interface UpdateBrokerAccountRequest {
  accountDisplayName?: string
  status?: BrokerAccountStatus
  credentials?: Record<string, unknown>
}

export interface VerifyBrokerAccountResponse {
  account: BrokerAccountItem
  verifyResult: Record<string, unknown>
}
