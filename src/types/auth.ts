export interface AuthStatusResponse {
  authEnabled: boolean
  loggedIn: boolean
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

export interface RegisterRequest {
  username: string
  password: string
  confirmPassword: string
  displayName?: string
}
