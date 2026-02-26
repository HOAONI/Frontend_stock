import type {
  AdminRoleItem,
  AdminRolesListResponse,
  CreateAdminRoleRequest,
  ListAdminRolesParams,
  UpdateAdminRoleRequest,
} from '@/types/admin-roles'
import client from './client'
import { toCamelCase } from './case'

function toPermissionBody(permissions: Array<{ moduleCode: string, canRead: boolean, canWrite: boolean }>) {
  return permissions.map(item => ({
    module_code: item.moduleCode,
    can_read: item.canRead,
    can_write: item.canWrite,
  }))
}

export async function listAdminRoles(params: ListAdminRolesParams = {}): Promise<AdminRolesListResponse> {
  const query: Record<string, unknown> = {
    page: params.page || 1,
    limit: params.limit || 20,
  }
  if (params.keyword)
    query.keyword = params.keyword

  const { data } = await client.get('/api/v1/admin/roles', { params: query })
  return toCamelCase<AdminRolesListResponse>(data)
}

export async function getAdminRoleDetail(id: number): Promise<AdminRoleItem> {
  const { data } = await client.get(`/api/v1/admin/roles/${id}`)
  return toCamelCase<AdminRoleItem>(data)
}

export async function createAdminRole(payload: CreateAdminRoleRequest): Promise<AdminRoleItem> {
  const body = {
    role_code: payload.roleCode,
    role_name: payload.roleName,
    description: payload.description,
    permissions: toPermissionBody(payload.permissions),
  }
  const { data } = await client.post('/api/v1/admin/roles', body)
  return toCamelCase<AdminRoleItem>(data)
}

export async function updateAdminRole(id: number, payload: UpdateAdminRoleRequest): Promise<AdminRoleItem> {
  const body = {
    role_code: payload.roleCode,
    role_name: payload.roleName,
    description: payload.description,
    permissions: payload.permissions ? toPermissionBody(payload.permissions) : undefined,
  }
  const { data } = await client.put(`/api/v1/admin/roles/${id}`, body)
  return toCamelCase<AdminRoleItem>(data)
}

export async function deleteAdminRole(id: number): Promise<void> {
  await client.delete(`/api/v1/admin/roles/${id}`)
}
