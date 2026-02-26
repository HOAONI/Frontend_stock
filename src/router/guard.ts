import type { Router } from 'vue-router'
import { useAppStore, useRouteStore, useSessionStore, useTabStore } from '@/store'

const title = import.meta.env.VITE_APP_NAME

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
  const tabStore = useTabStore()
  const sessionStore = useSessionStore()

  router.beforeEach(async (to, _from, next) => {
    if (to.meta.href) {
      window.open(to.meta.href)
      next(false)
      return
    }

    appStore.showProgress && window.$loadingBar?.start()

    try {
      await sessionStore.ensureStatus()
    }
    catch {
      window.$message.error('无法连接后端服务，请检查 Backend_stock 是否已启动')
      if (to.name !== 'login') {
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
      next()
      return
    }

    if (to.name === 'root') {
      if (sessionStore.needLogin) {
        next({ path: '/login', replace: true })
      }
      else {
        next({ path: import.meta.env.VITE_HOME_PATH, replace: true })
      }
      return
    }

    if (to.name === 'login') {
      if (!sessionStore.authEnabled) {
        next({ path: import.meta.env.VITE_HOME_PATH, replace: true })
        return
      }
      if (sessionStore.loggedIn) {
        const redirect = safeRedirect(String(to.query.redirect ?? ''))
        next({ path: redirect || import.meta.env.VITE_HOME_PATH, replace: true })
        return
      }
      next()
      return
    }

    const requiresAuth = to.meta.requiresAuth !== false
    if (requiresAuth && sessionStore.needLogin) {
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
    routeStore.setActiveMenu((to.meta.activeMenu as string) ?? to.fullPath)
    tabStore.addTab(to)
    tabStore.setCurrentTab(to.fullPath as string)
  })

  router.afterEach((to) => {
    document.title = `${to.meta.title} - ${title}`
    appStore.showProgress && window.$loadingBar?.finish()
  })
}
