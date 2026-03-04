import type {
  BindSimulationAccountRequest,
  BindSimulationAccountResponse,
  SimulationAccountStatusResponse,
} from '@/types/broker-account'
import client from './client'
import { toCamelCase } from './case'

export async function getSimulationAccountStatus(): Promise<SimulationAccountStatusResponse> {
  const { data } = await client.get('/api/v1/users/me/simulation-account/status')
  return toCamelCase<SimulationAccountStatusResponse>(data)
}

export async function bindSimulationAccount(payload: BindSimulationAccountRequest): Promise<BindSimulationAccountResponse> {
  const body: Record<string, unknown> = {
    initial_capital: payload.initialCapital,
    ...(payload.commissionRate != null ? { commission_rate: payload.commissionRate } : {}),
    ...(payload.slippageBps != null ? { slippage_bps: payload.slippageBps } : {}),
  }
  if (payload.accountUid !== undefined)
    body.account_uid = payload.accountUid
  if (payload.accountDisplayName !== undefined)
    body.account_display_name = payload.accountDisplayName

  const { data } = await client.post('/api/v1/users/me/simulation-account/bind', body)
  return toCamelCase<BindSimulationAccountResponse>(data)
}
