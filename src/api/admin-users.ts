import type {
  AdminUserItem,
  AdminUsersListResponse,
  CreateAdminUserRequest,
  ListAdminUsersParams,
  UpdateAdminUserRequest,
} from '@/types/admin-users'
import client from './client'
import { toCamelCase } from './case'

export async function listAdminUsers(params: ListAdminUsersParams = {}): Promise<AdminUsersListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }
  if (params.keyword)
    query.keyword = params.keyword
  if (params.status)
    query.status = params.status
  if (params.roleCode)
    query.role_code = params.roleCode

  const { data } = await client.get('/api/v1/admin/users', { params: query })
  return toCamelCase<AdminUsersListResponse>(data)
}

export async function getAdminUserDetail(id: number): Promise<AdminUserItem> {
  const { data } = await client.get(`/api/v1/admin/users/${id}`)
  return toCamelCase<AdminUserItem>(data)
}

export async function createAdminUser(payload: CreateAdminUserRequest): Promise<AdminUserItem> {
  const body = {
    username: payload.username,
    password: payload.password,
    display_name: payload.displayName,
    email: payload.email,
    status: payload.status,
    role_codes: payload.roleCodes,
  }
  const { data } = await client.post('/api/v1/admin/users', body)
  return toCamelCase<AdminUserItem>(data)
}

export async function updateAdminUser(id: number, payload: UpdateAdminUserRequest): Promise<AdminUserItem> {
  const body = {
    username: payload.username,
    display_name: payload.displayName,
    email: payload.email,
    status: payload.status,
    role_codes: payload.roleCodes,
  }
  const { data } = await client.put(`/api/v1/admin/users/${id}`, body)
  return toCamelCase<AdminUserItem>(data)
}

export async function updateAdminUserStatus(id: number, status: 'active' | 'disabled'): Promise<AdminUserItem> {
  const { data } = await client.put(`/api/v1/admin/users/${id}/status`, { status })
  return toCamelCase<AdminUserItem>(data)
}

export async function resetAdminUserPassword(id: number, newPassword: string): Promise<void> {
  await client.post(`/api/v1/admin/users/${id}/reset-password`, {
    new_password: newPassword,
  })
}

export async function deleteAdminUser(id: number): Promise<void> {
  await client.delete(`/api/v1/admin/users/${id}`)
}
