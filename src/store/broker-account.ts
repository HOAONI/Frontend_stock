/** 模拟盘账户 store，负责绑定流程、账户状态缓存和引导弹窗控制。 */
import type { AxiosError } from 'axios'
import type {
  BindSimulationAccountRequest,
  BindSimulationAccountResponse,
  SimulationAccountStatusResponse,
} from '@/types/broker-account'
import {
  bindSimulationAccount,
  getSimulationAccountStatus,
} from '@/api/broker-account'
import { useSessionStore } from './session'

interface BrokerAccountState {
  loading: boolean
  submitting: boolean
  error: string
  simulationStatus: SimulationAccountStatusResponse | null
  simulationStatusOwner: string
  simulationStatusLoadFailed: boolean
  simulationStatusError: string
  bindModalVisible: boolean
  bindError: string
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

export const useBrokerAccountStore = defineStore('broker-account-store', {
  state: (): BrokerAccountState => ({
    loading: false,
    submitting: false,
    error: '',
    simulationStatus: null,
    simulationStatusOwner: '',
    simulationStatusLoadFailed: false,
    simulationStatusError: '',
    bindModalVisible: false,
    bindError: '',
  }),
  actions: {
    resolveIdentityKey(): string {
      const sessionStore = useSessionStore()
      return sessionStore.currentUser?.username || 'anonymous'
    },

    dismissOnboardingForHours(_hours = 24) {
      this.closeBindModal()
    },

    clearOnboardingDismissedAt() {
      // 这里故意不做额外处理：引导弹窗完全以后端账户状态为准。
    },

    shouldShowSimulationOnboarding(): boolean {
      if (!this.simulationStatus)
        return true
      if (this.simulationStatus.requiresSetup)
        return true
      return !(this.simulationStatus.isBound && this.simulationStatus.isVerified)
    },

    openBindModal() {
      this.bindError = ''
      this.bindModalVisible = true
    },

    closeBindModal() {
      this.bindModalVisible = false
    },

    clearBindError() {
      this.bindError = ''
    },

    async loadSimulationStatus(): Promise<SimulationAccountStatusResponse> {
      this.loading = true
      this.error = ''
      this.simulationStatusLoadFailed = false
      this.simulationStatusError = ''
      try {
        const status = await getSimulationAccountStatus()
        this.simulationStatus = status
        this.simulationStatusOwner = this.resolveIdentityKey()
        if (status.isBound && status.isVerified && !status.requiresSetup)
          this.clearOnboardingDismissedAt()
        return status
      }
      catch (error: unknown) {
        const message = extractMessage(error, '加载模拟盘账户状态失败')
        this.error = message
        this.simulationStatusLoadFailed = true
        this.simulationStatusError = message
        throw error
      }
      finally {
        this.loading = false
      }
    },

    async ensureSimulationStatus(force = false): Promise<SimulationAccountStatusResponse> {
      const identity = this.resolveIdentityKey()
      if (!force && this.simulationStatus && this.simulationStatusOwner === identity)
        return this.simulationStatus
      if (this.simulationStatusOwner && this.simulationStatusOwner !== identity)
        this.simulationStatus = null
      return await this.loadSimulationStatus()
    },

    async bindSimulation(payload: BindSimulationAccountRequest): Promise<BindSimulationAccountResponse> {
      this.submitting = true
      this.error = ''
      this.bindError = ''
      try {
        const result = await bindSimulationAccount(payload)
        await this.loadSimulationStatus()
        this.clearOnboardingDismissedAt()
        this.closeBindModal()
        return result
      }
      catch (error: unknown) {
        const message = extractMessage(error, '初始化模拟账户失败')
        this.error = message
        this.bindError = message
        throw error
      }
      finally {
        this.submitting = false
      }
    },
  },
})
