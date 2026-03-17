import type { AxiosError } from 'axios'
import type { UpdateUserSettingsRequest, UserSettingsResponse } from '@/types/user-settings'
import { getMyUserSettings, updateMyUserSettings } from '@/api/user-settings'
import { createDefaultUserSettings } from '@/types/user-settings'

interface UserSettingsState {
  loading: boolean
  saving: boolean
  loaded: boolean
  error: string
  settings: UserSettingsResponse
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

// 兼容后端不同阶段返回的 ai 结构，统一为页面稳定可消费的形状。
function normalizeAiSettings(settings: UserSettingsResponse): UserSettingsResponse['ai'] {
  return {
    personalProvider: settings.ai?.personalProvider || '',
    personalModel: settings.ai?.personalModel || '',
    provider: settings.ai?.effective?.provider || settings.ai?.systemDefault?.provider || settings.ai?.provider || '',
    baseUrl: settings.ai?.effective?.baseUrl || settings.ai?.systemDefault?.baseUrl || settings.ai?.baseUrl || '',
    model: settings.ai?.effective?.model || settings.ai?.systemDefault?.model || settings.ai?.model || '',
    hasToken: Boolean(settings.ai?.hasToken),
    apiTokenMasked: settings.ai?.apiTokenMasked || '',
    source: settings.ai?.source || (settings.ai?.hasToken ? 'personal' : 'system'),
    hasSystemToken: Boolean(settings.ai?.hasSystemToken),
    requiresProviderReselection: Boolean(settings.ai?.requiresProviderReselection),
    personalBindingAvailable: settings.ai?.personalBindingAvailable ?? true,
    personalBindingIssue: settings.ai?.personalBindingIssue || '',
    systemDefault: {
      provider: settings.ai?.systemDefault?.provider || '',
      baseUrl: settings.ai?.systemDefault?.baseUrl || '',
      model: settings.ai?.systemDefault?.model || '',
      hasToken: Boolean(settings.ai?.systemDefault?.hasToken),
      source: settings.ai?.systemDefault?.source || 'none',
    },
    effective: {
      provider: settings.ai?.effective?.provider || settings.ai?.provider || '',
      baseUrl: settings.ai?.effective?.baseUrl || settings.ai?.baseUrl || '',
      model: settings.ai?.effective?.model || settings.ai?.model || '',
    },
  }
}

/**
 * 个人设置 store 负责把后端配置归一化后缓存到前端，
 * 避免页面直接处理 null、旧字段和 source/effective 的差异。
 */
export const useUserSettingsStore = defineStore('user-settings-store', {
  state: (): UserSettingsState => ({
    loading: false,
    saving: false,
    loaded: false,
    error: '',
    settings: createDefaultUserSettings(),
  }),
  actions: {
    applySettings(settings: UserSettingsResponse) {
      // 统一补默认值，保证表单始终拿到可编辑的完整模型。
      this.settings = {
        simulation: {
          accountName: settings.simulation?.accountName || '',
          accountId: settings.simulation?.accountId || '',
          initialCapital: Number(settings.simulation?.initialCapital ?? 100000),
          note: settings.simulation?.note || '',
        },
        ai: normalizeAiSettings(settings),
        strategy: {
          positionMaxPct: Number(settings.strategy?.positionMaxPct ?? 30),
          stopLossPct: Number(settings.strategy?.stopLossPct ?? 8),
          takeProfitPct: Number(settings.strategy?.takeProfitPct ?? 15),
        },
        updatedAt: settings.updatedAt || '',
      }
    },

    applyAiSettings(settings: UserSettingsResponse) {
      this.settings = {
        ...this.settings,
        ai: normalizeAiSettings(settings),
        updatedAt: settings.updatedAt || this.settings.updatedAt,
      }
    },

    async fetchMySettings(): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        const data = await getMyUserSettings()
        this.applySettings(data)
        this.loaded = true
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '加载个人设置失败')
        this.loaded = false
        throw error
      }
      finally {
        this.loading = false
      }
    },

    async saveMySettings(payload: UpdateUserSettingsRequest): Promise<{ success: boolean, error?: string }> {
      this.saving = true
      this.error = ''
      try {
        const data = await updateMyUserSettings(payload)
        this.applySettings(data)
        this.loaded = true
        return { success: true }
      }
      catch (error: unknown) {
        const message = extractMessage(error, '保存个人设置失败')
        this.error = message
        return {
          success: false,
          error: message,
        }
      }
      finally {
        this.saving = false
      }
    },
  },
})
