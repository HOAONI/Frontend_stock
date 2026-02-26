import type {
  BrokerAccountItem,
  BrokerAccountListResponse,
  CreateBrokerAccountRequest,
  UpdateBrokerAccountRequest,
  VerifyBrokerAccountResponse,
} from '@/types/broker-account'
import client from './client'
import { toCamelCase } from './case'

export async function listBrokerAccounts(limit = 50): Promise<BrokerAccountListResponse> {
  const { data } = await client.get('/api/v1/users/me/broker-accounts', {
    params: {
      limit,
    },
  })
  return toCamelCase<BrokerAccountListResponse>(data)
}

export async function createBrokerAccount(payload: CreateBrokerAccountRequest): Promise<BrokerAccountItem> {
  const body: Record<string, unknown> = {
    broker_code: payload.brokerCode,
    environment: payload.environment || 'paper',
    account_uid: payload.accountUid,
    credentials: payload.credentials,
  }
  if (payload.accountDisplayName !== undefined)
    body.account_display_name = payload.accountDisplayName

  const { data } = await client.post('/api/v1/users/me/broker-accounts', body)
  return toCamelCase<BrokerAccountItem>(data)
}

export async function updateBrokerAccount(id: number, payload: UpdateBrokerAccountRequest): Promise<BrokerAccountItem> {
  const body: Record<string, unknown> = {}
  if (payload.accountDisplayName !== undefined)
    body.account_display_name = payload.accountDisplayName
  if (payload.status !== undefined)
    body.status = payload.status
  if (payload.credentials !== undefined)
    body.credentials = payload.credentials

  const { data } = await client.put(`/api/v1/users/me/broker-accounts/${id}`, body)
  return toCamelCase<BrokerAccountItem>(data)
}

export async function verifyBrokerAccount(id: number): Promise<VerifyBrokerAccountResponse> {
  const { data } = await client.post(`/api/v1/users/me/broker-accounts/${id}/verify`)
  return toCamelCase<VerifyBrokerAccountResponse>(data)
}

export async function deleteBrokerAccount(id: number): Promise<{ ok: boolean }> {
  const { data } = await client.delete(`/api/v1/users/me/broker-accounts/${id}`)
  return toCamelCase<{ ok: boolean }>(data)
}
