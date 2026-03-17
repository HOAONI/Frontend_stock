/** 内置路由表定义登录页、404 页等无需后端权限的基础路由。 */
import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'root',
    children: [],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/build-in/login/index.vue'),
    meta: {
      title: '登录',
      requiresAuth: false,
      withoutTab: true,
    },
  },
  {
    path: '/not-found',
    name: 'not-found',
    component: () => import('@/views/build-in/not-found/index.vue'),
    meta: {
      title: '找不到页面',
      requiresAuth: false,
      icon: 'icon-park-outline:ghost',
      withoutTab: true,
    },
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/build-in/not-found/index.vue'),
    name: 'not-found-catch',
    meta: {
      title: '找不到页面',
      requiresAuth: false,
      icon: 'icon-park-outline:ghost',
      withoutTab: true,
    },
  },
]
