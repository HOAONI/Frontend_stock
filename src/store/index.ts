/** 全局状态安装入口，负责创建 Pinia 并注册持久化插件。 */
import type { App } from 'vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

export * from './app/index'
export * from './router'
export * from './session'
export * from './broker-account'
export * from './trading-account'
export * from './user-settings'

// 安装pinia全局状态库
export function installPinia(app: App) {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)
}
