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
      this.settings = {
        simulation: {
          accountName: settings.simulation?.accountName || '',
          accountId: settings.simulation?.accountId || '',
          initialCapital: Number(settings.simulation?.initialCapital ?? 100000),
          note: settings.simulation?.note || '',
        },
        ai: {
          provider: settings.ai?.provider || 'openai',
          baseUrl: settings.ai?.baseUrl || 'https://api.openai.com/v1',
          model: settings.ai?.model || 'gpt-4o-mini',
          hasToken: Boolean(settings.ai?.hasToken),
          apiTokenMasked: settings.ai?.apiTokenMasked || '',
        },
        strategy: {
          positionMaxPct: Number(settings.strategy?.positionMaxPct ?? 30),
          stopLossPct: Number(settings.strategy?.stopLossPct ?? 8),
          takeProfitPct: Number(settings.strategy?.takeProfitPct ?? 15),
        },
        updatedAt: settings.updatedAt || '',
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
