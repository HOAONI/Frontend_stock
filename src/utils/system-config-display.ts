import type {
  SystemConfigCategory,
  SystemConfigDataType,
  SystemConfigFieldSchema,
  SystemConfigItem,
} from '@/types/system-config'

// 把系统配置的原始 key/结构定义翻译成前端可展示的标题、分类和说明，避免页面散落硬编码。
interface CategoryDisplayMeta {
  title: string
  description: string
}

interface FieldDisplayMeta {
  title: string
  description: string
}

type ConfigDisplaySource = string | Pick<SystemConfigItem, 'key' | 'schema'> | SystemConfigFieldSchema

const CATEGORY_DISPLAY_MAP: Record<SystemConfigCategory, CategoryDisplayMeta> = {
  base: {
    title: '基础配置',
    description: '控制服务运行、任务执行和默认行为的基础参数。',
  },
  ai_model: {
    title: 'AI 模型',
    description: '配置大模型服务商、模型名称与访问凭证。',
  },
  data_source: {
    title: '数据源',
    description: '配置行情、检索和外部服务接入所需的数据源参数。',
  },
  notification: {
    title: '通知',
    description: '配置 Webhook、邮件或消息通知通道。',
  },
  system: {
    title: '系统配置',
    description: '配置服务部署、数据库、跨域和后台认证等系统级参数。',
  },
  backtest: {
    title: '回测参数',
    description: '配置回测评估窗口、引擎版本和默认交易成本。',
  },
  uncategorized: {
    title: '未分类',
    description: '尚未归入明确分类的配置项。',
  },
}

const DATA_TYPE_LABEL_MAP: Record<SystemConfigDataType, string> = {
  string: '文本',
  integer: '整数',
  number: '数值',
  boolean: '布尔开关',
  array: '列表',
  json: 'JSON',
  time: '时间',
}

const FIELD_DISPLAY_MAP: Record<string, FieldDisplayMeta> = {
  NODE_ENV: {
    title: '运行环境',
    description: '控制当前服务使用开发、测试或生产运行模式。',
  },
  PORT: {
    title: '服务端口',
    description: 'Backend API 对外监听的端口号。',
  },
  HOST: {
    title: '监听地址',
    description: 'Backend API 绑定的主机地址。',
  },
  ENV_FILE: {
    title: '环境文件路径',
    description: '指定系统配置初始化时读取的环境变量文件。',
  },
  DATABASE_URL: {
    title: '数据库连接',
    description: 'PostgreSQL 数据库的完整连接地址。',
  },
  AGENT_BASE_URL: {
    title: 'Agent 服务地址',
    description: '主 Agent 服务的基础访问地址。',
  },
  AGENT_SERVICE_AUTH_TOKEN: {
    title: 'Agent 服务令牌',
    description: 'Backend 调用 Agent 服务时使用的鉴权令牌。',
  },
  AGENT_REQUEST_TIMEOUT_MS: {
    title: 'Agent 请求超时',
    description: 'Backend 等待 Agent 接口响应的最长时间，单位毫秒。',
  },
  AGENT_TASK_POLL_INTERVAL_MS: {
    title: 'Agent 任务轮询间隔',
    description: '查询 Agent 异步任务状态的时间间隔，单位毫秒。',
  },
  AGENT_TASK_POLL_TIMEOUT_MS: {
    title: 'Agent 任务轮询超时',
    description: '等待 Agent 异步任务完成的总超时时间，单位毫秒。',
  },
  AGENT_TASK_POLL_MAX_RETRIES: {
    title: 'Agent 任务最大重试次数',
    description: '任务轮询失败后的最大重试次数。',
  },
  ANALYSIS_TASK_STALE_TIMEOUT_MS: {
    title: '分析任务超时阈值',
    description: '判断任务疑似卡死所使用的超时时间，单位毫秒。',
  },
  SCHEDULER_HEARTBEAT_TTL_MS: {
    title: '调度心跳有效期',
    description: '判断 Worker 心跳是否超时所使用的时间窗口，单位毫秒。',
  },
  AGENT_TASK_RETRY_BASE_DELAY_MS: {
    title: 'Agent 重试基础延迟',
    description: 'Agent 请求失败后每次重试的基础等待时间，单位毫秒。',
  },
  CORS_ORIGINS: {
    title: '跨域允许来源',
    description: '允许访问 Backend API 的前端域名列表。',
  },
  CORS_ALLOW_ALL: {
    title: '允许所有跨域来源',
    description: '是否放开 CORS，允许任意来源访问当前服务。',
  },
  ADMIN_AUTH_ENABLED: {
    title: '后台认证开关',
    description: '控制后台账号体系与会话认证是否启用。',
  },
  ADMIN_SELF_REGISTER_ENABLED: {
    title: '自助注册开关',
    description: '控制普通用户和管理员是否允许通过前端自行注册。',
  },
  ADMIN_REGISTER_SECRET: {
    title: '管理员注册密钥',
    description: '管理员自助注册时必须输入的专属密钥。',
  },
  ADMIN_SESSION_MAX_AGE_HOURS: {
    title: '后台会话有效时长',
    description: '后台登录态 Cookie 的有效期，单位小时。',
  },
  ADMIN_SESSION_SECRET: {
    title: '后台会话签名密钥',
    description: '用于签发和校验后台会话 Cookie 的密钥。',
  },
  TRUST_X_FORWARDED_FOR: {
    title: '信任代理请求头',
    description: '是否信任反向代理传来的真实来源 IP 与协议头。',
  },
  ADMIN_INIT_USERNAME: {
    title: '初始管理员用户名',
    description: '系统首次启动时自动创建的管理员账号用户名。',
  },
  ADMIN_INIT_PASSWORD: {
    title: '初始管理员密码',
    description: '系统首次启动时自动创建的管理员账号密码。',
  },
  RUN_WORKER_IN_API: {
    title: 'API 内嵌 Worker',
    description: '控制后台 API 进程是否同时启动内部 Worker。',
  },
  GEMINI_API_KEY: {
    title: 'Gemini 密钥',
    description: '访问 Gemini 模型服务所需的 API Key。',
  },
  GEMINI_MODEL: {
    title: 'Gemini 模型名',
    description: '默认使用的 Gemini 模型标识。',
  },
  ANTHROPIC_API_KEY: {
    title: 'Anthropic 密钥',
    description: '访问 Anthropic 模型服务所需的 API Key。',
  },
  ANTHROPIC_MODEL: {
    title: 'Anthropic 模型名',
    description: '默认使用的 Anthropic 模型标识。',
  },
  OPENAI_API_KEY: {
    title: 'OpenAI 密钥',
    description: '访问 OpenAI 模型服务所需的 API Key。',
  },
  OPENAI_BASE_URL: {
    title: 'OpenAI 接口地址',
    description: 'OpenAI 或兼容网关服务的基础请求地址。',
  },
  OPENAI_MODEL: {
    title: 'OpenAI 文本模型',
    description: '默认使用的 OpenAI 文本模型名称。',
  },
  OPENAI_VISION_MODEL: {
    title: 'OpenAI 视觉模型',
    description: '处理图片理解等任务时使用的视觉模型名称。',
  },
  BACKTEST_EVAL_WINDOW_DAYS: {
    title: '回测评估窗口',
    description: '执行回测统计时采用的评估时间窗口，单位天。',
  },
  BACKTEST_MIN_AGE_DAYS: {
    title: '回测最小样本天数',
    description: '参与回测前所需的最小历史样本长度，单位天。',
  },
  BACKTEST_ENGINE_VERSION: {
    title: '回测引擎版本',
    description: '指定当前系统使用的回测引擎版本标识。',
  },
  BACKTEST_NEUTRAL_BAND_PCT: {
    title: '回测中性区间阈值',
    description: '判断信号中性区间时使用的百分比阈值。',
  },
  LEGACY_SQLITE_PATH: {
    title: '历史 SQLite 路径',
    description: '旧版分析数据或兼容数据所使用的 SQLite 文件路径。',
  },
  BROKER_SECRET_KEY: {
    title: '券商密钥',
    description: 'Backend 与券商模拟网关通讯使用的签名密钥。',
  },
  BROKER_GATEWAY_BASE_URL: {
    title: '券商网关地址',
    description: '券商或模拟交易网关的基础访问地址。',
  },
  BROKER_GATEWAY_AUTH_TOKEN: {
    title: '券商网关令牌',
    description: '调用券商网关接口时使用的鉴权令牌。',
  },
  BROKER_GATEWAY_SOURCE_SERVICE: {
    title: '券商来源服务标识',
    description: '请求券商网关时标识当前来源服务的名称。',
  },
  BACKTRADER_AGENT_BASE_URL: {
    title: 'Backtrader Agent 地址',
    description: '本地 Backtrader 仿真/回测 Agent 的访问地址。',
  },
  BACKTRADER_AGENT_TOKEN: {
    title: 'Backtrader Agent 令牌',
    description: '调用 Backtrader Agent 时使用的鉴权令牌。',
  },
  BACKTRADER_AGENT_TIMEOUT_MS: {
    title: 'Backtrader Agent 超时',
    description: '等待 Backtrader Agent 响应的最长时间，单位毫秒。',
  },
  BACKTRADER_DEFAULT_COMMISSION: {
    title: '默认佣金率',
    description: 'Backtrader 默认交易佣金比例。',
  },
  BACKTRADER_DEFAULT_SLIPPAGE_BPS: {
    title: '默认滑点基点',
    description: 'Backtrader 默认滑点设置，单位基点。',
  },
  SIM_PROVIDER_DEFAULT_CODE: {
    title: '默认模拟提供方',
    description: '系统默认使用的模拟交易提供方代码。',
  },
  SIMULATION_BIND_BROKER_CODE: {
    title: '模拟账户绑定券商',
    description: '新建模拟账户时默认绑定的券商代码。',
  },
  ANALYSIS_AUTO_ORDER_ENABLED: {
    title: '分析后自动下单',
    description: '控制分析完成后是否允许自动生成并提交订单。',
  },
  ANALYSIS_AUTO_ORDER_TYPE: {
    title: '自动下单类型',
    description: '分析后自动下单所采用的订单类型。',
  },
  ANALYSIS_AUTO_ORDER_A_SHARE_ONLY: {
    title: '自动下单仅限 A 股',
    description: '是否只允许对 A 股股票执行自动下单。',
  },
  ANALYSIS_AUTO_ORDER_MAX_NOTIONAL: {
    title: '自动下单最大金额',
    description: '单笔自动下单允许使用的最大成交金额。',
  },
  ANALYSIS_AUTO_ORDER_MAX_QTY: {
    title: '自动下单最大数量',
    description: '单笔自动下单允许提交的最大委托数量。',
  },
  ANALYSIS_AUTO_ORDER_ENFORCE_SESSION: {
    title: '自动下单限制交易时段',
    description: '是否只允许在设定的交易时段内自动下单。',
  },
  ANALYSIS_AUTO_ORDER_TIMEZONE: {
    title: '自动下单时区',
    description: '自动下单交易时段解析所采用的时区。',
  },
  ANALYSIS_AUTO_ORDER_TRADING_SESSIONS: {
    title: '自动下单交易时段',
    description: '允许执行自动下单的时间区间列表。',
  },
  BROKER_SNAPSHOT_CACHE_TTL_MS: {
    title: '券商快照缓存时长',
    description: '券商行情快照缓存的有效时间，单位毫秒。',
  },
  BACKTEST_AGENT_BASE_URL: {
    title: '回测 Agent 地址',
    description: '专用回测 Agent 服务的访问地址。',
  },
  BACKTEST_AGENT_TOKEN: {
    title: '回测 Agent 令牌',
    description: '调用回测 Agent 时使用的鉴权令牌。',
  },
  BACKTEST_AGENT_TIMEOUT_MS: {
    title: '回测 Agent 超时',
    description: '等待回测 Agent 响应的最长时间，单位毫秒。',
  },
  PERSONAL_SECRET_KEY: {
    title: '个人数据密钥',
    description: '用于保护个人敏感配置或私有数据的加密密钥。',
  },
  AGENT_FORWARD_RUNTIME_CONFIG: {
    title: '转发运行配置到 Agent',
    description: '是否将运行期配置透传给 Agent 服务使用。',
  },
}

function normalizeKey(key: string | null | undefined): string {
  return String(key || '').trim().toUpperCase()
}

function isFieldSchema(source: Exclude<ConfigDisplaySource, string>): source is SystemConfigFieldSchema {
  return 'category' in source && 'dataType' in source
}

function resolveSource(source: ConfigDisplaySource): { key: string, schema?: SystemConfigFieldSchema } {
  if (typeof source === 'string') {
    return { key: normalizeKey(source) }
  }

  if (!isFieldSchema(source)) {
    return {
      key: normalizeKey(source.key),
      schema: source.schema,
    }
  }

  return {
    key: normalizeKey(source.key),
    schema: source,
  }
}

export function getSystemConfigCategoryDisplay(category?: string | null): CategoryDisplayMeta {
  const normalized = String(category || '').trim() as SystemConfigCategory
  return CATEGORY_DISPLAY_MAP[normalized] ?? {
    title: normalized || '未分类',
    description: '',
  }
}

export function getSystemConfigDataTypeLabel(dataType?: string | null): string {
  const normalized = String(dataType || '').trim() as SystemConfigDataType
  return DATA_TYPE_LABEL_MAP[normalized] ?? (normalized || '文本')
}

export function getSystemConfigFieldDisplay(source: ConfigDisplaySource) {
  const { key, schema } = resolveSource(source)
  const fieldMeta = FIELD_DISPLAY_MAP[key]
  const categoryDisplay = getSystemConfigCategoryDisplay(schema?.category)

  return {
    key,
    title: fieldMeta?.title || schema?.title || key,
    description: fieldMeta?.description || schema?.description || '',
    category: schema?.category || 'uncategorized',
    categoryTitle: categoryDisplay.title,
    categoryDescription: categoryDisplay.description,
    dataType: schema?.dataType || 'string',
    dataTypeLabel: getSystemConfigDataTypeLabel(schema?.dataType),
  }
}
