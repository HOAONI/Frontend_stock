import type {
  AuthStatusResponse,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
} from '@/types/auth'
import client from './client'

function parseCurrentUser(data: unknown): AuthStatusResponse['currentUser'] {
  if (!data || typeof data !== 'object')
    return undefined
  const raw = data as {
    id?: number | string
    username?: string
    displayName?: string | null
    roles?: unknown
    role?: unknown
  }
  if (!raw.username)
    return undefined

  const rolesFromList = Array.isArray(raw.roles)
    ? raw.roles.map(item => String(item).trim()).filter(Boolean)
    : []
  const roleFromSingle = typeof raw.role === 'string' && raw.role.trim()
    ? [raw.role.trim()]
    : []
  const roles = Array.from(new Set([...rolesFromList, ...roleFromSingle]))
  if (roles.length === 0)
    return undefined

  return {
    id: raw.id ?? '',
    username: String(raw.username),
    displayName: raw.displayName == null ? null : String(raw.displayName),
    role: roleFromSingle[0] || null,
    roles,
  }
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const { data } = await client.get<AuthStatusResponse>('/api/v1/auth/status')
  return {
    authEnabled: Boolean(data.authEnabled),
    loggedIn: Boolean(data.loggedIn),
    passwordChangeable: Boolean(data.passwordChangeable),
    currentUser: parseCurrentUser(data.currentUser),
  }
}

export async function login(payload: LoginRequest): Promise<void> {
  await client.post('/api/v1/auth/login', payload)
}

export async function register(payload: RegisterRequest): Promise<void> {
  await client.post('/api/v1/auth/register', {
    username: payload.username,
    password: payload.password,
    confirmPassword: payload.confirmPassword,
    displayName: payload.displayName,
    accountType: payload.accountType,
    adminSecret: payload.adminSecret,
  })
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await client.post('/api/v1/auth/change-password', payload)
}

export async function logout(): Promise<void> {
  await client.post('/api/v1/auth/logout')
}
