/**
 * 把字节数转换成人类可读的容量单位字符串。
 *
 * @param bytes 需要转换的字节大小
 * @returns 转换后的容量字符串
 * @example
 * ```
 * // 输出：'1 MB'
 * normalizeSizeUnits(1048576)
 * ```
 */
export function normalizeSizeUnits(bytes: number): string {
  if (bytes === 0)
    return '0 bytes'

  const units = ['bytes', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = +(bytes / 1024 ** index).toFixed(2)
  const unit = units[index]

  return `${size} ${unit}`
}
