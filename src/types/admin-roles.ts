export interface RolePermissionItem {
  moduleCode: string
  canRead: boolean
  canWrite: boolean
}

export interface AdminRoleItem {
  id: number
  roleCode: string
  roleName: string
  description?: string | null
  isBuiltin: boolean
  permissions: RolePermissionItem[]
  assignedUserCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminRolesListResponse {
  total: number
  page: number
  limit: number
  items: AdminRoleItem[]
}

export interface ListAdminRolesParams {
  keyword?: string
  page?: number
  limit?: number
}

export interface CreateAdminRoleRequest {
  roleCode: string
  roleName: string
  description?: string
  permissions: RolePermissionItem[]
}

export interface UpdateAdminRoleRequest {
  roleCode?: string
  roleName?: string
  description?: string
  permissions?: RolePermissionItem[]
}

export interface RbacModuleOption {
  moduleCode: string
  label: string
}

export const RBAC_MODULE_OPTIONS: RbacModuleOption[] = [
  { moduleCode: 'analysis', label: '分析' },
  { moduleCode: 'history', label: '历史' },
  { moduleCode: 'stocks', label: '行情' },
  { moduleCode: 'backtest', label: '回测' },
  { moduleCode: 'system_config', label: '系统配置' },
  { moduleCode: 'user_settings', label: '个人设置' },
  { moduleCode: 'admin_user', label: '用户管理' },
  { moduleCode: 'admin_role', label: '角色管理' },
  { moduleCode: 'admin_log', label: '操作日志' },
  { moduleCode: 'auth', label: '认证管理' },
]
