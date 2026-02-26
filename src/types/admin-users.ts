export type AdminUserStatus = 'active' | 'disabled'

export interface AdminUserRoleItem {
  id: number
  roleCode: string
  roleName: string
  isBuiltin: boolean
}

export interface AdminUserItem {
  id: number
  username: string
  displayName?: string | null
  email?: string | null
  status: AdminUserStatus
  roles: AdminUserRoleItem[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

export interface AdminUsersListResponse {
  total: number
  page: number
  limit: number
  items: AdminUserItem[]
}

export interface ListAdminUsersParams {
  keyword?: string
  status?: AdminUserStatus
  roleCode?: string
  page?: number
  limit?: number
}

export interface CreateAdminUserRequest {
  username: string
  password: string
  displayName?: string
  email?: string
  status?: AdminUserStatus
  roleCodes: string[]
}

export interface UpdateAdminUserRequest {
  username?: string
  displayName?: string
  email?: string
  status?: AdminUserStatus
  roleCodes?: string[]
}
