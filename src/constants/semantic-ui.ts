/** 语义化展示常量，集中维护状态标签、颜色和文案映射。 */
import type { CSSProperties } from 'vue'

export type SemanticType = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'

const semanticColorMap: Record<Exclude<SemanticType, 'default'>, string> = {
  primary: 'var(--n-primary-color)',
  success: 'var(--n-success-color)',
  warning: 'var(--n-warning-color)',
  error: 'var(--n-error-color)',
  info: 'var(--n-info-color)',
}

interface TrendTypeOptions {
  positive?: Exclude<SemanticType, 'default'>
  negative?: Exclude<SemanticType, 'default'>
  neutral?: SemanticType
}

export function semanticValueStyle(type: SemanticType): CSSProperties | undefined {
  if (type === 'default')
    return undefined
  return { color: semanticColorMap[type] }
}

export function trendSemanticType(value: number | null | undefined, options: TrendTypeOptions = {}): SemanticType {
  const positive = options.positive || 'success'
  const negative = options.negative || 'error'
  const neutral = options.neutral || 'info'

  if (value == null || Number.isNaN(value))
    return 'default'
  if (value > 0)
    return positive
  if (value < 0)
    return negative
  return neutral
}

export function trendValueStyle(value: number | null | undefined, options: TrendTypeOptions = {}): CSSProperties | undefined {
  return semanticValueStyle(trendSemanticType(value, options))
}

export function lifecycleSemanticType(status: string | null | undefined): SemanticType {
  if (!status)
    return 'default'

  const value = status.toLowerCase()

  if (
    value.includes('ready')
    || value.includes('ok')
    || value.includes('success')
    || value.includes('completed')
    || value.includes('done')
    || value.includes('verified')
    || value.includes('bound')
    || value.includes('已就绪')
    || value.includes('成功')
    || value.includes('完成')
  ) {
    return 'success'
  }

  if (
    value.includes('processing')
    || value.includes('pending')
    || value.includes('queue')
    || value.includes('running')
    || value.includes('处理中')
    || value.includes('排队')
  ) {
    return 'info'
  }

  if (
    value.includes('warning')
    || value.includes('retry')
    || value.includes('stale')
    || value.includes('degraded')
    || value.includes('初始化')
    || value.includes('校验')
    || value.includes('待')
    || value.includes('警告')
  ) {
    return 'warning'
  }

  if (
    value.includes('fail')
    || value.includes('error')
    || value.includes('reject')
    || value.includes('invalid')
    || value.includes('异常')
    || value.includes('失败')
    || value.includes('错误')
  ) {
    return 'error'
  }

  return 'default'
}
