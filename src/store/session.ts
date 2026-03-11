import type { AxiosError } from 'axios'
import type { RegisterRequest } from '@/types/auth'
import { getAuthStatus, login, logout, register } from '@/api/auth'
import { useRouteStore } from './router'
import { useTabStore } from './tab'

interface SessionState {
  initialized: boolean
  loading: boolean
  authEnabled: boolean
  loggedIn: boolean
  currentUser: {
    id: number | string
    username: string
    displayName?: string | null
    roles: string[]
  } | null
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

function extractRegisterError(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>
  const status = axiosError?.response?.status
  const message = axiosError?.response?.data?.message

  if (status === 404 || status === 405 || status === 501) {
    return '当前后端未开放自助注册，请联系管理员创建账号'
  }
  if (status === 409) {
    return message || '用户名已存在'
  }
  if (status === 400) {
    return message || '注册参数校验失败，请检查输入'
  }
  if (status === 403) {
    return message || '管理员专属密钥错误'
  }

  return message || '注册失败，请稍后重试'
}

function normalizeRoleCode(roleCode: string | null | undefined): string {
  const value = String(roleCode || '').trim().toLowerCase()
  if (value === 'super_admin')
    return 'admin'
  if (value === 'analyst' || value === 'operator')
    return 'user'
  return value
}

function normalizeCurrentUser(user: SessionState['currentUser'] | undefined | null): SessionState['currentUser'] {
  if (!user)
    return null

  return {
    ...user,
    roles: Array.from(new Set((user.roles || []).map(normalizeRoleCode).filter(Boolean))),
  }
}

export const useSessionStore = defineStore('session-store', {
  state: (): SessionState => ({
    initialized: false,
    loading: false,
    authEnabled: false,
    loggedIn: false,
    currentUser: null,
  }),
  getters: {
    needLogin(state): boolean {
      return state.authEnabled && !state.loggedIn
    },
    isAdmin(state): boolean {
      return state.currentUser?.roles.includes('admin') ?? false
    },
    isNormalUser(state): boolean {
      return state.loggedIn && !this.isAdmin
    },
  },
  actions: {
    async fetchStatus(): Promise<void> {
      this.loading = true
      try {
        const status = await getAuthStatus()
        this.authEnabled = status.authEnabled
        this.loggedIn = status.loggedIn
        this.currentUser = normalizeCurrentUser(status.currentUser ?? null)
        this.initialized = true
      }
      finally {
        this.loading = false
      }
    },

    async ensureStatus(force = false): Promise<void> {
      if (this.initialized && !force)
        return
      await this.fetchStatus()
    },

    async doLogin(username: string, password: string): Promise<{ success: boolean, error?: string }> {
      try {
        await login({ username, password })
        await this.fetchStatus()
        const routeStore = useRouteStore()
        const tabStore = useTabStore()
        routeStore.resetRouteStore()
        tabStore.clearAllTabs()
        return { success: true }
      }
      catch (error: unknown) {
        const axiosError = error as AxiosError<{ message?: string }>
        if (axiosError?.response?.status === 401) {
          return {
            success: false,
            error: '用户名或密码错误',
          }
        }
        return {
          success: false,
          error: extractMessage(error, '登录失败'),
        }
      }
    },

    async doRegister(payload: RegisterRequest): Promise<{ success: boolean, error?: string }> {
      try {
        await register(payload)
        await this.fetchStatus()
        if (this.authEnabled && !this.loggedIn) {
          return {
            success: false,
            error: '注册成功但登录状态未建立，请手动登录',
          }
        }
        const routeStore = useRouteStore()
        const tabStore = useTabStore()
        routeStore.resetRouteStore()
        tabStore.clearAllTabs()
        return { success: true }
      }
      catch (error: unknown) {
        return {
          success: false,
          error: extractRegisterError(error),
        }
      }
    },

    async doLogout(): Promise<void> {
      try {
        await logout()
      }
      finally {
        const routeStore = useRouteStore()
        const tabStore = useTabStore()
        routeStore.resetRouteStore()
        tabStore.clearAllTabs()
        this.loggedIn = false
        this.currentUser = null
        this.initialized = false
      }
    },
  },
})
