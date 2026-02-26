export type AiProvider = 'openai' | 'deepseek' | 'custom'

export interface UserSimulationSettings {
  accountName: string
  accountId: string
  initialCapital: number
  note: string
}

export interface UserAiSettings {
  provider: AiProvider
  baseUrl: string
  model: string
  hasToken: boolean
  apiTokenMasked: string
}

export interface UserStrategySettings {
  positionMaxPct: number
  stopLossPct: number
  takeProfitPct: number
}

export interface UserSettingsResponse {
  simulation: UserSimulationSettings
  ai: UserAiSettings
  strategy: UserStrategySettings
  updatedAt: string
}

export interface UpdateUserSettingsRequest {
  simulation?: Partial<UserSimulationSettings>
  ai?: {
    provider?: AiProvider
    baseUrl?: string
    model?: string
    apiToken?: string
  }
  strategy?: Partial<UserStrategySettings>
}

export function createDefaultUserSettings(): UserSettingsResponse {
  return {
    simulation: {
      accountName: '',
      accountId: '',
      initialCapital: 100000,
      note: '',
    },
    ai: {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      hasToken: false,
      apiTokenMasked: '',
    },
    strategy: {
      positionMaxPct: 30,
      stopLossPct: 8,
      takeProfitPct: 15,
    },
    updatedAt: '',
  }
}
