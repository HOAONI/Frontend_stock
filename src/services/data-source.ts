/** 数据源模式辅助工具，负责判断当前环境使用真实接口还是前端派生数据。 */
export type DataMode = 'hybrid' | 'api' | 'mock'
export type DataSourceTag = 'api' | 'mock' | 'derived'

export interface ServicePayload<T> {
  data: T
  dataSource: DataSourceTag
  missingApis: string[]
  warnings: string[]
}

function toDataMode(value: string | undefined): DataMode {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'api')
    return 'api'
  if (text === 'mock')
    return 'mock'
  return 'hybrid'
}

export function getDataMode(): DataMode {
  return toDataMode(import.meta.env.VITE_DATA_MODE)
}

export function shouldEnableBadge(): boolean {
  const raw = String(import.meta.env.VITE_ENABLE_MOCK_BADGE ?? 'true').toLowerCase()
  return raw !== 'false'
}

export function isMissingApiStatus(status: number | undefined): boolean {
  return status === 404 || status === 405 || status === 501
}

export function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}
