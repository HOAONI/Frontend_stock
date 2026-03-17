<script setup lang="ts">
// 应用初始化组件负责按顺序注册状态、路由和全局模块，再渲染主界面。
import type { App } from 'vue'
import NaiveProvider from '@/components/common/NaiveProvider.vue'
import { installRouter } from '@/router'
import { installPinia } from '@/store'
import { dateZhCN, zhCN } from 'naive-ui'

// 创建异步初始化 Promise - 这会让组件变成异步组件
const initializationPromise = (async () => {
  // 获取当前应用实例
  const app = getCurrentInstance()?.appContext.app
  if (!app) {
    throw new Error('Failed to get app instance')
  }

  // 注册模块 Pinia
  await installPinia(app)

  // 注册模块 Vue-router
  await installRouter(app)

  // 注册模块 指令/静态资源
  const modules = import.meta.glob<{ install: (app: App) => void }>('./modules/*.ts', {
    eager: true,
  })

  Object.values(modules).forEach(module => app.use(module))

  return true
})()

// 等待初始化完成 - 这使得整个 setup 函数变成异步的
await initializationPromise
</script>

<template>
  <n-config-provider
    class="wh-full"
    inline-theme-disabled
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NaiveProvider>
      <router-view />
    </NaiveProvider>
  </n-config-provider>
</template>
