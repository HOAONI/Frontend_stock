/** 指令模块注册入口，负责自动安装项目内的自定义指令。 */
import type { App } from 'vue'

export function install(app: App) {
  /* 自动注册指令 */
  Object.values(
    import.meta.glob<{ install: (app: App) => void }>('@/directives/*.ts', {
      eager: true,
    }),
  ).map(i => app.use(i))
}
