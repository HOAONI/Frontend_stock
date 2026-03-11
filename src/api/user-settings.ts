import type { UpdateUserSettingsRequest, UserSettingsResponse } from '@/types/user-settings'
import client from './client'
import { toCamelCase } from './case'

export async function getMyUserSettings(): Promise<UserSettingsResponse> {
  const { data } = await client.get('/api/v1/users/me/settings')
  return toCamelCase<UserSettingsResponse>(data)
}

export async function updateMyUserSettings(payload: UpdateUserSettingsRequest): Promise<UserSettingsResponse> {
  const body: Record<string, unknown> = {}

  if (payload.simulation) {
    const simulation: Record<string, unknown> = {}
    if (payload.simulation.accountName !== undefined)
      simulation.accountName = payload.simulation.accountName
    if (payload.simulation.accountId !== undefined)
      simulation.accountId = payload.simulation.accountId
    if (payload.simulation.initialCapital !== undefined)
      simulation.initialCapital = payload.simulation.initialCapital
    if (payload.simulation.note !== undefined)
      simulation.note = payload.simulation.note
    body.simulation = simulation
  }

  if (payload.ai) {
    const ai: Record<string, unknown> = {}
    if (payload.ai.provider !== undefined)
      ai.provider = payload.ai.provider
    if (payload.ai.apiToken !== undefined)
      ai.apiToken = payload.ai.apiToken
    body.ai = ai
  }

  if (payload.strategy) {
    const strategy: Record<string, unknown> = {}
    if (payload.strategy.positionMaxPct !== undefined)
      strategy.positionMaxPct = payload.strategy.positionMaxPct
    if (payload.strategy.stopLossPct !== undefined)
      strategy.stopLossPct = payload.strategy.stopLossPct
    if (payload.strategy.takeProfitPct !== undefined)
      strategy.takeProfitPct = payload.strategy.takeProfitPct
    body.strategy = strategy
  }

  const { data } = await client.put('/api/v1/users/me/settings', body)
  return toCamelCase<UserSettingsResponse>(data)
}
