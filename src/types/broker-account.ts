/** 模拟盘绑定相关类型定义，描述账户状态和绑定请求结构。 */
export interface SimulationAccountStatusResponse {
  isBound: boolean
  isVerified: boolean
  requiresSetup?: boolean
  brokerAccountId: number | null
  accountUid: string | null
  accountDisplayName: string | null
  brokerCode: string | null
  providerCode: string | null
  providerName: string | null
  complianceRegion: string | null
  autoOrderEnabled: boolean
  engine?: string | null
  environment: string | null
  lastVerifiedAt: string | null
}

export interface BindSimulationAccountRequest {
  accountUid?: string
  accountDisplayName?: string
  initialCapital: number
  commissionRate?: number
  slippageBps?: number
}

export interface BindSimulationAccountResponse {
  account: Record<string, unknown>
  verifyResult: Record<string, unknown>
}
