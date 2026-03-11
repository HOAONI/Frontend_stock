export type AiProvider = 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'custom'
export type PersonalAiProvider = 'openai' | 'deepseek'

export interface UserAiRuntimeMeta {
  provider: AiProvider | ''
  baseUrl: string
  model: string
}

export interface UserAiSystemRuntimeMeta extends UserAiRuntimeMeta {
  hasToken: boolean
  source: 'agent_runtime' | 'agent_env_fallback' | 'system_config' | 'none'
}

export interface UserSimulationSettings {
  accountName: string
  accountId: string
  initialCapital: number
  note: string
}

export interface UserAiSettings {
  personalProvider: PersonalAiProvider | ''
  provider: AiProvider | ''
  baseUrl: string
  model: string
  hasToken: boolean
  apiTokenMasked: string
  source: 'system' | 'personal'
  hasSystemToken: boolean
  requiresProviderReselection: boolean
  systemDefault: UserAiSystemRuntimeMeta
  effective: UserAiRuntimeMeta
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
    provider?: PersonalAiProvider
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
      personalProvider: '',
      provider: '',
      baseUrl: '',
      model: '',
      hasToken: false,
      apiTokenMasked: '',
      source: 'system',
      hasSystemToken: false,
      requiresProviderReselection: false,
      systemDefault: {
        provider: '',
        baseUrl: '',
        model: '',
        hasToken: false,
        source: 'none',
      },
      effective: {
        provider: '',
        baseUrl: '',
        model: '',
      },
    },
    strategy: {
      positionMaxPct: 30,
      stopLossPct: 8,
      takeProfitPct: 15,
    },
    updatedAt: '',
  }
}
