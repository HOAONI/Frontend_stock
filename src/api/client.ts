/** Axios 客户端配置，统一处理基础地址、鉴权失效跳转和通用请求头。 */
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/'
const timeout = Number(import.meta.env.VITE_API_TIMEOUT || '30000')
const routeMode = import.meta.env.VITE_ROUTE_MODE || 'hash'
const routeBase = import.meta.env.VITE_BASE_URL || '/'

/** 把配置中的 base path 规范成以 `/` 开头的可拼接路径。 */
function normalizeBasePath(input: string): string {
  const value = String(input || '/').trim()
  if (!value)
    return '/'
  return value.startsWith('/') ? value : `/${value}`
}

/** 移除尾部 `/`，便于后续做路由前缀比较。 */
function trimTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith('/'))
    return path.slice(0, -1)
  return path
}

/** 去掉 Vite 部署前缀，得到项目内部真实的访问路径。 */
function stripBasePath(pathname: string): string {
  const base = trimTrailingSlash(normalizeBasePath(routeBase))
  const raw = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (base !== '/' && raw.startsWith(base)) {
    const stripped = raw.slice(base.length)
    if (!stripped)
      return '/'
    return stripped.startsWith('/') ? stripped : `/${stripped}`
  }
  return raw
}

/** 兼容 hash / history 两种模式，生成登录后可回跳的当前路由。 */
function resolveCurrentRoute(): string {
  if (routeMode === 'hash') {
    const hash = String(window.location.hash || '').trim()
    if (hash.startsWith('#/'))
      return hash.slice(1)
    if (hash.startsWith('#')) {
      const path = hash.slice(1)
      return path.startsWith('/') ? path : `/${path}`
    }
  }
  const path = stripBasePath(window.location.pathname)
  return `${path}${window.location.search}${window.location.hash}`
}

/** 避免 401 时在登录页上再次触发重定向，造成地址抖动。 */
function isLoginRoute(): boolean {
  if (routeMode === 'hash')
    return String(window.location.hash || '').startsWith('#/login')
  return stripBasePath(window.location.pathname).startsWith('/login')
}

/** 根据当前路由模式生成登录页地址，并附带回跳参数。 */
function resolveLoginUrl(redirect: string): string {
  const base = trimTrailingSlash(normalizeBasePath(routeBase))
  const prefix = base === '/' ? '' : base
  if (routeMode === 'hash')
    return `${prefix}/#/login?redirect=${redirect}`
  return `${prefix}/login?redirect=${redirect}`
}

const client = axios.create({
  baseURL,
  timeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.response.use(
  response => response,
  (error) => {
    const status = error?.response?.status
    const apiError = String(error?.response?.data?.error || '').trim().toLowerCase()
    if (status === 401 && apiError === 'unauthorized') {
      // 仅在后端明确认定“未登录”时才统一跳转，避免把普通业务错误误判成掉线。
      const redirect = encodeURIComponent(resolveCurrentRoute())
      if (!isLoginRoute())
        window.location.assign(resolveLoginUrl(redirect))
    }
    return Promise.reject(error)
  },
)

export default client
