import type { AxiosError } from 'axios'
import type {
  BrokerAccountItem,
  CreateBrokerAccountRequest,
  UpdateBrokerAccountRequest,
  VerifyBrokerAccountResponse,
} from '@/types/broker-account'
import {
  createBrokerAccount,
  deleteBrokerAccount,
  listBrokerAccounts,
  updateBrokerAccount,
  verifyBrokerAccount,
} from '@/api/broker-account'
import { useSessionStore } from './session'

interface BrokerAccountState {
  loading: boolean
  submitting: boolean
  loaded: boolean
  error: string
  items: BrokerAccountItem[]
  selectedAccountId: number | null
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

function parseStoredAccountId(value: string | null): number | null {
  if (!value)
    return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    return null
  return parsed
}

export const useBrokerAccountStore = defineStore('broker-account-store', {
  state: (): BrokerAccountState => ({
    loading: false,
    submitting: false,
    loaded: false,
    error: '',
    items: [],
    selectedAccountId: null,
  }),
  getters: {
    selectedAccount(state): BrokerAccountItem | null {
      if (state.selectedAccountId == null)
        return null
      return state.items.find(item => item.id === state.selectedAccountId) || null
    },
    activeAccounts(state): BrokerAccountItem[] {
      return state.items.filter(item => item.status === 'active')
    },
  },
  actions: {
    resolveStorageKey(): string {
      const sessionStore = useSessionStore()
      const username = sessionStore.currentUser?.username || 'anonymous'
      return `selected-broker-account:${username}`
    },

    readStoredSelection(): number | null {
      try {
        return parseStoredAccountId(localStorage.getItem(this.resolveStorageKey()))
      }
      catch {
        return null
      }
    },

    persistSelection() {
      try {
        const key = this.resolveStorageKey()
        if (this.selectedAccountId == null) {
          localStorage.removeItem(key)
        }
        else {
          localStorage.setItem(key, String(this.selectedAccountId))
        }
      }
      catch {}
    },

    pickDefaultSelection(items: BrokerAccountItem[]): number | null {
      const preferred = items.find(item => item.status === 'active' && item.isVerified)
      if (preferred)
        return preferred.id

      const fallback = items.find(item => item.status === 'active')
      return fallback?.id || null
    },

    syncSelectedAccount() {
      const activeIds = new Set(this.activeAccounts.map(item => item.id))
      const current = this.selectedAccountId
      if (current != null && activeIds.has(current)) {
        this.persistSelection()
        return
      }

      const stored = this.readStoredSelection()
      if (stored != null && activeIds.has(stored)) {
        this.selectedAccountId = stored
        this.persistSelection()
        return
      }

      this.selectedAccountId = this.pickDefaultSelection(this.items)
      this.persistSelection()
    },

    setSelectedAccount(id: number | null) {
      if (id == null) {
        this.selectedAccountId = null
        this.persistSelection()
        return
      }

      const target = this.items.find(item => item.id === id && item.status === 'active')
      this.selectedAccountId = target?.id || this.pickDefaultSelection(this.items)
      this.persistSelection()
    },

    async loadAccounts(limit = 50): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        const result = await listBrokerAccounts(limit)
        this.items = result.items || []
        this.loaded = true
        this.syncSelectedAccount()
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '加载券商账户失败')
        this.loaded = false
        throw error
      }
      finally {
        this.loading = false
      }
    },

    async ensureLoaded(): Promise<void> {
      if (this.loaded)
        return
      await this.loadAccounts()
    },

    async createAccount(payload: CreateBrokerAccountRequest): Promise<BrokerAccountItem> {
      this.submitting = true
      try {
        const created = await createBrokerAccount(payload)
        await this.loadAccounts()
        this.setSelectedAccount(created.id)
        return created
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '创建账户失败')
        throw error
      }
      finally {
        this.submitting = false
      }
    },

    async updateAccount(id: number, payload: UpdateBrokerAccountRequest): Promise<BrokerAccountItem> {
      this.submitting = true
      try {
        const updated = await updateBrokerAccount(id, payload)
        await this.loadAccounts()
        this.setSelectedAccount(updated.id)
        return updated
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '更新账户失败')
        throw error
      }
      finally {
        this.submitting = false
      }
    },

    async verifyAccount(id: number): Promise<VerifyBrokerAccountResponse> {
      this.submitting = true
      try {
        const verified = await verifyBrokerAccount(id)
        await this.loadAccounts()
        this.setSelectedAccount(verified.account.id)
        return verified
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '账户校验失败')
        throw error
      }
      finally {
        this.submitting = false
      }
    },

    async removeAccount(id: number): Promise<void> {
      this.submitting = true
      try {
        await deleteBrokerAccount(id)
        if (this.selectedAccountId === id)
          this.selectedAccountId = null
        await this.loadAccounts()
      }
      catch (error: unknown) {
        this.error = extractMessage(error, '删除账户失败')
        throw error
      }
      finally {
        this.submitting = false
      }
    },
  },
})
