/** 认证相关类型定义，描述会话状态、登录注册参数和改密参数。 */
export type RegisterAccountType = 'user' | 'admin'

export interface AuthStatusResponse {
  authEnabled: boolean
  loggedIn: boolean
  passwordChangeable: boolean
  currentUser?: {
    id: number | string
    username: string
    displayName?: string | null
    role?: string | null
    roles: string[]
  }
}

export interface LoginRequest {
  username: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  newPasswordConfirm: string
}

export interface RegisterRequest {
  username: string
  password: string
  confirmPassword: string
  displayName?: string
  accountType?: RegisterAccountType
  adminSecret?: string
}
