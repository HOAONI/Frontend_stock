/** 股票相关通用工具，负责股票代码校验、时间格式化和展示兜底。 */
export function validateStockCode(value: string): { valid: boolean, message?: string, normalized: string } {
  const normalized = value.trim().toUpperCase()
  if (!normalized) {
    return { valid: false, message: '请输入股票代码', normalized }
  }

  const patterns = [
    /^\d{6}$/,
    /^(SH|SZ)\d{6}$/,
    /^\d{5}$/,
    /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/,
  ]

  if (!patterns.some(regex => regex.test(normalized))) {
    return { valid: false, message: '股票代码格式不正确', normalized }
  }

  return { valid: true, normalized }
}

export function validateAShareMarketCode(value: string): { valid: boolean, message?: string, normalized: string } {
  const normalized = value.trim().toUpperCase()
  if (!normalized) {
    return { valid: false, message: '请输入股票代码', normalized }
  }

  if (/^\d{6}$/.test(normalized)) {
    return { valid: true, normalized }
  }

  if (/^(SH|SZ)\d{6}$/.test(normalized)) {
    return { valid: true, normalized }
  }

  if (/^\d{6}\.(SH|SZ|SS)$/.test(normalized)) {
    return { valid: true, normalized }
  }

  return { valid: false, message: 'A股行情页仅支持 SH/SZ/6 位代码', normalized }
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getRecentStartDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toDateInputValue(d)
}

export function formatDateTime(value?: string | null): string {
  if (!value)
    return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatPct(value?: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value))
    return '--'
  return `${value.toFixed(digits)}%`
}
