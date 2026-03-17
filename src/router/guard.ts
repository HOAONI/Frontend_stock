/** 路由守卫负责登录态检查、默认跳转和权限路由初始化。 */
import type { Router } from 'vue-router'
import { HOME_PATH } from '@/constants/home-path'
import { useAppStore, useRouteStore, useSessionStore } from '@/store'

const title = import.meta.env.VITE_APP_NAME

/** 只允许站内绝对路径参与回跳，避免开放重定向风险。 */
function safeRedirect(toPath: string | undefined): string | undefined {
  if (!toPath)
    return undefined
  if (!toPath.startsWith('/') || toPath.startsWith('//'))
    return undefined
  return toPath
}

export function setupRouterGuard(router: Router) {
  const appStore = useAppStore()
  const routeStore = useRouteStore()
  const sessionStore = useSessionStore()

  router.beforeEach(async (to, _from, next) => {
    if (to.meta.href) {
      // 菜单中的外链节点不进入应用内路由，直接新窗口打开。
      window.open(to.meta.href)
      next(false)
      return
    }

    appStore.showProgress && window.$loadingBar?.start()

    try {
      await sessionStore.ensureStatus()
    }
    catch {
      // 启动期如果后端不可达，优先提示用户基础依赖未启动，而不是静默留在空白页。
      window.$message.error('无法连接后端服务，请检查 Backend_stock 是否已启动')
      if (to.name !== 'login') {
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
      next()
      return
    }

    if (to.name === 'root') {
      // 根路径只做分流：未登录去登录页，已登录进入首页。
      if (sessionStore.needLogin) {
        next({ path: '/login', replace: true })
      }
      else {
        next({ path: HOME_PATH, replace: true })
      }
      return
    }

    if (to.name === 'login') {
      // 关闭认证时不允许停留在登录页；已登录用户则按 redirect 回到原页面。
      if (!sessionStore.authEnabled) {
        next({ path: HOME_PATH, replace: true })
        return
      }
      if (sessionStore.loggedIn) {
        const redirect = safeRedirect(String(to.query.redirect ?? ''))
        next({ path: redirect || HOME_PATH, replace: true })
        return
      }
      next()
      return
    }

    const requiresAuth = to.meta.requiresAuth !== false
    if (requiresAuth && sessionStore.needLogin) {
      // 受保护页面统一带着原始目标地址跳转登录，登录成功后可直接回到业务页。
      next({
        path: '/login',
        query: {
          redirect: safeRedirect(to.fullPath),
        },
      })
      return
    }

    if (!routeStore.isInitAuthRoute) {
      try {
        await routeStore.initAuthRoute()
        if (to.name === 'not-found' || to.name === 'not-found-catch') {
          // 动态路由补齐后重新进入一次当前地址，避免首刷时误判成 404。
          next({
            path: to.fullPath,
            replace: true,
            query: to.query,
            hash: to.hash,
          })
          return
        }
      }
      catch {
        next({ path: '/login', query: { redirect: safeRedirect(to.fullPath) } })
        return
      }
    }

    next()
  })

  router.beforeResolve((to) => {
    // `activeMenu` 允许“详情页不在菜单中，但仍高亮某个入口页”的后台场景。
    routeStore.setActiveMenu((to.meta.activeMenu as string) ?? to.fullPath)
  })

  router.afterEach((to) => {
    document.title = `${to.meta.title} - ${title}`
    appStore.showProgress && window.$loadingBar?.finish()
  })
}
