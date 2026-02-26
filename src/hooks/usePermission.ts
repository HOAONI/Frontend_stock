import { useSessionStore } from '@/store'
import { isArray, isString } from 'radash'

/** 权限判断 */
export function usePermission() {
  const sessionStore = useSessionStore()

  function hasPermission(
    permission?: Entity.RoleType | Entity.RoleType[],
  ) {
    if (!permission)
      return true

    if (!sessionStore.authEnabled)
      return true

    const roles = sessionStore.currentUser?.roles || []
    if (roles.length === 0)
      return false

    let has = roles.includes('super_admin')
    if (!has) {
      if (isArray(permission))
        has = permission.some(i => roles.includes(i))

      if (isString(permission))
        has = roles.includes(permission)
    }
    return has
  }

  return {
    hasPermission,
  }
}
