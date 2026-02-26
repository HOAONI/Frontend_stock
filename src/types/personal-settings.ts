export type AiProvider = 'openai' | 'deepseek' | 'custom'

export interface SimulationAccountSettings {
  accountName: string
  accountId: string
  initialCapital: number
  note: string
}

export interface PersonalAiSettings {
  provider: AiProvider
  baseUrl: string
  model: string
  apiToken: string
}

export interface PersonalStrategySettings {
  positionMaxPct: number
  stopLossPct: number
  takeProfitPct: number
}

export interface PersonalSettings {
  simulation: SimulationAccountSettings
  ai: PersonalAiSettings
  strategy: PersonalStrategySettings
  updatedAt: string
}

export function createDefaultPersonalSettings(): PersonalSettings {
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
      apiToken: '',
    },
    strategy: {
      positionMaxPct: 30,
      stopLossPct: 8,
      takeProfitPct: 15,
    },
    updatedAt: '',
  }
}
