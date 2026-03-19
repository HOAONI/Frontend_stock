/** 系统配置相关类型定义，描述配置 schema、值结构和校验结果。 */
/** 配置项所属的大类。 */
export type SystemConfigCategory = 'base' | 'data_source' | 'ai_model' | 'notification' | 'system' | 'backtest' | 'uncategorized'

/** 配置项的数据类型。 */
export type SystemConfigDataType = 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'json' | 'time'

/** 配置页建议使用的表单控件类型。 */
export type SystemConfigUIControl = 'text' | 'password' | 'number' | 'select' | 'textarea' | 'switch' | 'time'

/** 单个配置字段的 schema 描述。 */
export interface SystemConfigFieldSchema {
  key: string
  title?: string
  description?: string
  category: SystemConfigCategory
  dataType: SystemConfigDataType
  uiControl: SystemConfigUIControl
  isSensitive: boolean
  isRequired: boolean
  isEditable: boolean
  visibleInStrategyPage: boolean
  editLockReason?: string
  defaultValue?: string | null
  options: string[]
  validation: Record<string, unknown>
  displayOrder: number
}

/** 配置分类及其字段集合。 */
export interface SystemConfigCategorySchema {
  category: SystemConfigCategory
  title: string
  description?: string
  displayOrder: number
  fields: SystemConfigFieldSchema[]
}

/** 配置结构接口返回值。 */
export interface SystemConfigSchemaResponse {
  schemaVersion: string
  categories: SystemConfigCategorySchema[]
}

/** 单个配置项当前值。 */
export interface SystemConfigItem {
  key: string
  value: string
  rawValueExists: boolean
  isMasked: boolean
  schema?: SystemConfigFieldSchema
}

/** 当前系统配置快照。 */
export interface SystemConfigResponse {
  configVersion: string
  maskToken: string
  items: SystemConfigItem[]
  updatedAt?: string | null
}

/** 提交更新时的一条配置变更。 */
export interface SystemConfigUpdateItem {
  key: string
  value: string
}

/** 提交系统配置更新的请求体。 */
export interface UpdateSystemConfigRequest {
  configVersion: string
  maskToken?: string
  reloadNow?: boolean
  items: SystemConfigUpdateItem[]
}

/** 更新接口返回值。 */
export interface UpdateSystemConfigResponse {
  success: boolean
  configVersion: string
  appliedCount: number
  skippedMaskedCount: number
  reloadTriggered: boolean
  updatedKeys: string[]
  warnings: string[]
}

/** 仅做校验时的请求体。 */
export interface ValidateSystemConfigRequest {
  items: SystemConfigUpdateItem[]
}

/** 单条配置校验问题。 */
export interface ConfigValidationIssue {
  key: string
  code: string
  message: string
  severity: 'error' | 'warning'
  expected?: string
  actual?: string
}

/** 校验接口返回值。 */
export interface ValidateSystemConfigResponse {
  valid: boolean
  issues: ConfigValidationIssue[]
}

/** 后端返回 422 时的标准错误体。 */
export interface SystemConfigValidationErrorResponse {
  error: string
  message: string
  issues: ConfigValidationIssue[]
}

/** 配置版本冲突时的返回结构。 */
export interface SystemConfigConflictResponse {
  error: string
  message: string
  currentConfigVersion: string
}
