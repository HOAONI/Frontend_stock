/** 个人设置相关类型定义，描述 AI 配置、模拟盘参数和默认策略设置。 */
/** 页面可选择的 AI 服务商范围。 */
export type AiProvider = 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'custom' | 'siliconflow'
/** 个人绑定场景当前允许的 AI 服务商范围。 */
export type PersonalAiProvider = 'openai' | 'deepseek' | 'siliconflow'
export type AgentChatExecutionPolicy = 'auto_execute_if_condition_met' | 'confirm_before_execute'
export type AgentChatResponseStyle = 'concise_factual' | 'balanced' | 'detailed'
export type UserRiskProfile = 'conservative' | 'balanced' | 'aggressive'
export type UserAnalysisStrategy = 'auto' | 'ma' | 'rsi' | 'custom'

/** AI 运行时最终使用的 provider / baseUrl / model 组合。 */
export interface UserAiRuntimeMeta {
  provider: AiProvider | ''
  baseUrl: string
  model: string
}

/** 系统默认 AI 配置的来源及可用状态。 */
export interface UserAiSystemRuntimeMeta extends UserAiRuntimeMeta {
  hasToken: boolean
  source: 'agent_runtime' | 'agent_env_fallback' | 'system_config' | 'none'
}

/** 模拟盘绑定与默认资金设置。 */
export interface UserSimulationSettings {
  accountName: string
  accountId: string
  initialCapital: number
  note: string
}

/** 个人 AI 绑定页与运行页共享的完整设置结构。 */
export interface UserAiSettings {
  personalProvider: PersonalAiProvider | ''
  personalModel: string
  provider: AiProvider | ''
  baseUrl: string
  model: string
  hasToken: boolean
  apiToken: string
  apiTokenReadable: boolean
  apiTokenReadIssue: string
  apiTokenMasked: string
  source: 'system' | 'personal'
  hasSystemToken: boolean
  requiresProviderReselection: boolean
  personalBindingAvailable: boolean
  personalBindingIssue: string
  systemDefault: UserAiSystemRuntimeMeta
  effective: UserAiRuntimeMeta
}

/** 个人默认策略参数。 */
export interface UserStrategySettings {
  riskProfile: UserRiskProfile
  analysisStrategy: UserAnalysisStrategy
  maxSingleTradeAmount: number | null
  positionMaxPct: number
  stopLossPct: number
  takeProfitPct: number
}

/** Agent 对话偏好，只保存跨会话稳定的行为策略。 */
export interface UserAgentChatSettings {
  executionPolicy: AgentChatExecutionPolicy
  confirmationShortcutsEnabled: boolean
  followupFocusResolutionEnabled: boolean
  responseStyle: AgentChatResponseStyle
}

/** 当前用户完整设置快照。 */
export interface UserSettingsResponse {
  simulation: UserSimulationSettings
  ai: UserAiSettings
  strategy: UserStrategySettings
  agentChat: UserAgentChatSettings
  updatedAt: string
}

/** 提交个人设置更新时的请求体。 */
export interface UpdateUserSettingsRequest {
  simulation?: Partial<UserSimulationSettings>
  ai?: {
    provider?: PersonalAiProvider
    model?: string
    apiToken?: string
  }
  strategy?: Partial<UserStrategySettings>
  agentChat?: Partial<UserAgentChatSettings>
}

/** 创建一份带默认值的用户设置模型，供 store 和表单初始化复用。 */
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
      personalModel: '',
      provider: '',
      baseUrl: '',
      model: '',
      hasToken: false,
      apiToken: '',
      apiTokenReadable: true,
      apiTokenReadIssue: '',
      apiTokenMasked: '',
      source: 'system',
      hasSystemToken: false,
      requiresProviderReselection: false,
      personalBindingAvailable: true,
      personalBindingIssue: '',
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
      riskProfile: 'balanced',
      analysisStrategy: 'auto',
      maxSingleTradeAmount: null,
      positionMaxPct: 30,
      stopLossPct: 8,
      takeProfitPct: 15,
    },
    agentChat: {
      executionPolicy: 'auto_execute_if_condition_met',
      confirmationShortcutsEnabled: true,
      followupFocusResolutionEnabled: true,
      responseStyle: 'concise_factual',
    },
    updatedAt: '',
  }
}
