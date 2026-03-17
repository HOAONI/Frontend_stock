/** 路由 store 负责缓存菜单、原始路由和当前高亮菜单状态。 */
import type { MenuOption } from 'naive-ui'
import { router } from '@/router'
import { staticRoutes } from '@/router/routes.static'
import { createMenus, createRoutes } from './helper'

interface RoutesStatus {
  isInitAuthRoute: boolean
  menus: MenuOption[]
  rowRoutes: AppRoute.RowRoute[]
  activeMenu: string | null
}
export const useRouteStore = defineStore('route-store', {
  state: (): RoutesStatus => {
    return {
      isInitAuthRoute: false,
      activeMenu: null,
      menus: [],
      rowRoutes: [],
    }
  },
  actions: {
    resetRouteStore() {
      this.resetRoutes()
      this.$reset()
    },
    resetRoutes() {
      if (router.hasRoute('appRoot'))
        router.removeRoute('appRoot')
    },
    // 设置当前高亮菜单 key，供侧边栏和面包屑同步状态。
    setActiveMenu(key: string) {
      this.activeMenu = key
    },
    async initAuthRoute() {
      this.isInitAuthRoute = false

      try {
        const rowRoutes = staticRoutes
        this.rowRoutes = rowRoutes

        // 生成真实路由并注入到路由实例。
        const routes = createRoutes(rowRoutes)
        router.addRoute(routes)

        // 根据原始路由生成侧边菜单。
        this.menus = createMenus(rowRoutes)

        this.isInitAuthRoute = true
      }
      catch (error) {
        // 重置状态并重新抛出错误
        this.isInitAuthRoute = false
        throw error
      }
    },
  },
})
