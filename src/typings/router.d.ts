/** 扩展 Vue Router 的元信息类型，让路由 meta 使用项目自定义字段。 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta extends AppRoute.RouteMeta {}
}
