/** 路由转换辅助工具，负责把后台路由结构整理为真实路由树和侧边菜单。 */
import type { MenuOption } from 'naive-ui'
import type { RouteRecordRaw } from 'vue-router'
import { HOME_PATH } from '@/constants/home-path'
import { usePermission } from '@/hooks'
import Layout from '@/layouts/index.vue'
import { arrayToTree, renderIcon } from '@/utils'
import { clone, min, omit, pick } from 'radash'
import { RouterLink } from 'vue-router'

const metaFields: AppRoute.MetaKeys[]
  = ['title', 'icon', 'requiresAuth', 'roles', 'keepAlive', 'hide', 'order', 'href', 'activeMenu', 'withoutTab', 'pinTab', 'menuType']

function standardizedRoutes(route: AppRoute.RowRoute[]) {
  return clone(route).map((i) => {
    const route = omit(i, metaFields)

    Reflect.set(route, 'meta', pick(i, metaFields))
    return route
  }) as AppRoute.Route[]
}

export function createRoutes(routes: AppRoute.RowRoute[]) {
  const { hasPermission } = usePermission()

  // 把行路由上的展示字段整理到标准 meta 对象中。
  let resultRouter = standardizedRoutes(routes)

  // 先按角色权限过滤掉当前用户不可见的路由。
  resultRouter = resultRouter.filter(i => hasPermission(i.meta.roles))

  // 为真实页面路由挂载组件；纯重定向节点无需导入页面文件。
  const modules = import.meta.glob('@/views/**/*.vue')
  resultRouter = resultRouter.map((item: AppRoute.Route) => {
    if (item.componentPath && !item.redirect)
      item.component = modules[`/src/views${item.componentPath}`]
    return item
  })

  // 把平铺路由整理成树形结构，供路由实例和菜单共用。
  resultRouter = arrayToTree(resultRouter) as AppRoute.Route[]

  const appRootRoute: RouteRecordRaw = {
    path: '/appRoot',
    name: 'appRoot',
    redirect: HOME_PATH,
    component: Layout,
    meta: {
      title: '',
      icon: 'icon-park-outline:home',
    },
    children: [],
  }

  // 递归补齐目录路由的默认 redirect，避免父级菜单点开后落空。
  setRedirect(resultRouter)

  // 把处理后的业务路由挂到应用根路由下面。
  appRootRoute.children = resultRouter as unknown as RouteRecordRaw[]
  return appRootRoute
}

function setRedirect(routes: AppRoute.Route[]) {
  routes.forEach((route) => {
    if (route.children) {
      if (!route.redirect) {
        // 先筛出可见子路由，默认跳转不能落到隐藏页面。
        const visibleChilds = route.children.filter(child => !child.meta.hide)

        // 默认跳到第一个可见子页面，保证目录路由有稳定落点。
        let target = visibleChilds[0]

        // 如果子页面配置了 order，则优先按排序值决定默认落点。
        const orderChilds = visibleChilds.filter(child => child.meta.order)

        if (orderChilds.length > 0)
          target = min(orderChilds, i => i.meta.order!) as AppRoute.Route

        if (target)
          route.redirect = target.path
      }

      setRedirect(route.children)
    }
  })
}

/* 生成侧边菜单的数据 */
export function createMenus(userRoutes: AppRoute.RowRoute[]) {
  const resultMenus = standardizedRoutes(userRoutes)

  // 过滤掉不需要出现在侧边栏中的菜单。
  const visibleMenus = resultMenus.filter(route => !route.meta.hide)

  // 生成侧边栏所需的树形菜单数据。
  return arrayToTree(transformAuthRoutesToMenus(visibleMenus))
}

// 把返回的路由结构转换成 Naive UI 侧边菜单数据。
function transformAuthRoutesToMenus(userRoutes: AppRoute.Route[]) {
  const { hasPermission } = usePermission()
  return userRoutes
    // 过滤掉当前用户无权访问的侧边菜单项。
    .filter(i => hasPermission(i.meta.roles))
    // 按 order 值排序，保证菜单展示顺序稳定。
    .sort((a, b) => {
      if (a.meta && a.meta.order && b.meta && b.meta.order)
        return a.meta.order - b.meta.order
      else if (a.meta && a.meta.order)
        return -1
      else if (b.meta && b.meta.order)
        return 1
      else return 0
    })
    // 转换成 Naive UI `MenuOption` 结构。
    .map((item) => {
      const target: MenuOption = {
        id: item.id,
        pid: item.pid,
        label:
          (!item.meta.menuType || item.meta.menuType === 'page')
            ? () =>
                h(
                  RouterLink,
                  {
                    to: {
                      path: item.path,
                    },
                  },
                  { default: () => item.meta.title },
                )
            : () => item.meta.title,
        key: item.path,
        icon: item.meta.icon ? renderIcon(item.meta.icon) : undefined,
      }
      return target
    })
}
