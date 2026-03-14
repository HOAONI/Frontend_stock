interface ImportMetaEnv {
  /** 项目基本地址 */
  readonly VITE_BASE_URL: string
  /** 项目标题 */
  readonly VITE_APP_NAME: string
  /** 路由模式 */
  readonly VITE_ROUTE_MODE?: 'hash' | 'web'
  /** 首次加载页面 */
  readonly VITE_HOME_PATH: string
  /** 版权信息 */
  readonly VITE_COPYRIGHT_INFO: string
  /** API 基础地址 */
  readonly VITE_API_BASE_URL?: string
  /** API 超时（毫秒） */
  readonly VITE_API_TIMEOUT?: string
  /** 数据模式（hybrid/api/mock） */
  readonly VITE_DATA_MODE?: 'hybrid' | 'api' | 'mock'
  /** 是否展示模拟/派生数据标签 */
  readonly VITE_ENABLE_MOCK_BADGE?: 'true' | 'false'
  /** 开发代理目标 */
  readonly VITE_PROXY_TARGET?: string
  /** 当前模式 */
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
