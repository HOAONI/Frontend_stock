/** 系统配置接口封装，负责读取配置、校验草稿和提交更新。 */
import type {
  SystemConfigConflictResponse,
  SystemConfigResponse,
  SystemConfigSchemaResponse,
  SystemConfigValidationErrorResponse,
  UpdateSystemConfigRequest,
  UpdateSystemConfigResponse,
  ValidateSystemConfigRequest,
  ValidateSystemConfigResponse,
} from '@/types/system-config'
import client from './client'
import { toCamelCase } from './case'

export class SystemConfigValidationError extends Error {
  issues: SystemConfigValidationErrorResponse['issues']

  constructor(message: string, issues: SystemConfigValidationErrorResponse['issues']) {
    super(message)
    this.name = 'SystemConfigValidationError'
    this.issues = issues
  }
}

export class SystemConfigConflictError extends Error {
  currentConfigVersion?: string

  constructor(message: string, currentConfigVersion?: string) {
    super(message)
    this.name = 'SystemConfigConflictError'
    this.currentConfigVersion = currentConfigVersion
  }
}

export async function getSystemConfig(includeSchema = true): Promise<SystemConfigResponse> {
  const { data } = await client.get('/api/v1/system/config', {
    params: { include_schema: includeSchema },
  })
  return toCamelCase<SystemConfigResponse>(data)
}

export async function getSystemConfigSchema(): Promise<SystemConfigSchemaResponse> {
  const { data } = await client.get('/api/v1/system/config/schema')
  return toCamelCase<SystemConfigSchemaResponse>(data)
}

export async function validateSystemConfig(payload: ValidateSystemConfigRequest): Promise<ValidateSystemConfigResponse> {
  const { data } = await client.post('/api/v1/system/config/validate', {
    items: payload.items.map(item => ({ key: item.key, value: item.value })),
  })
  return toCamelCase<ValidateSystemConfigResponse>(data)
}

export async function updateSystemConfig(payload: UpdateSystemConfigRequest): Promise<UpdateSystemConfigResponse> {
  try {
    const { data } = await client.put('/api/v1/system/config', {
      config_version: payload.configVersion,
      mask_token: payload.maskToken,
      reload_now: payload.reloadNow ?? true,
      items: payload.items.map(item => ({ key: item.key, value: item.value })),
    })
    return toCamelCase<UpdateSystemConfigResponse>(data)
  }
  catch (error: unknown) {
    const response = (error as { response?: { status?: number, data?: unknown } }).response
    const status = response?.status
    if (status === 400) {
      const body = toCamelCase<SystemConfigValidationErrorResponse>(response?.data)
      throw new SystemConfigValidationError(body.message || '配置校验失败', body.issues || [])
    }
    if (status === 409) {
      const body = toCamelCase<SystemConfigConflictResponse>(response?.data)
      throw new SystemConfigConflictError(body.message || '配置版本冲突', body.currentConfigVersion)
    }
    throw error
  }
}
