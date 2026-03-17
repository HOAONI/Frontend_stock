/** 接口字段格式兼容工具，负责把后端返回的下划线键名转换为驼峰键名。 */
function isPlainObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]'
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function toCamelCase<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map(item => toCamelCase(item)) as T
  }

  if (isPlainObject(input)) {
    const output: Record<string, unknown> = {}
    Object.entries(input).forEach(([key, value]) => {
      output[toCamelKey(key)] = toCamelCase(value)
    })
    return output as T
  }

  return input as T
}
