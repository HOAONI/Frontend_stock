/** 权限指令负责按角色或权限控制局部 DOM 的展示。 */
import type { App, Directive } from 'vue'
import { usePermission } from '@/hooks'

export function install(app: App) {
  const { hasPermission } = usePermission()

  function updatapermission(el: HTMLElement, permission: Entity.RoleType | Entity.RoleType[]) {
    if (!permission)
      throw new Error('v-permissson Directive with no explicit role attached')

    if (!hasPermission(permission))
      el.parentElement?.removeChild(el)
  }

  const permissionDirective: Directive<HTMLElement, Entity.RoleType | Entity.RoleType[]> = {
    mounted(el, binding) {
      updatapermission(el, binding.value)
    },
    updated(el, binding) {
      updatapermission(el, binding.value)
    },
  }
  app.directive('permission', permissionDirective)
}
