import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/'
const timeout = Number(import.meta.env.VITE_API_TIMEOUT || '30000')
const routeMode = import.meta.env.VITE_ROUTE_MODE || 'hash'
const routeBase = import.meta.env.VITE_BASE_URL || '/'

function normalizeBasePath(input: string): string {
  const value = String(input || '/').trim()
  if (!value)
    return '/'
  return value.startsWith('/') ? value : `/${value}`
}

function trimTrailingSlash(path: string): string {
  if (path.length > 1 && path.endsWith('/'))
    return path.slice(0, -1)
  return path
}

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

function isLoginRoute(): boolean {
  if (routeMode === 'hash')
    return String(window.location.hash || '').startsWith('#/login')
  return stripBasePath(window.location.pathname).startsWith('/login')
}

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
      const redirect = encodeURIComponent(resolveCurrentRoute())
      if (!isLoginRoute())
        window.location.assign(resolveLoginUrl(redirect))
    }
    return Promise.reject(error)
  },
)

export default client
