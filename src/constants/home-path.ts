const DEFAULT_HOME_PATH = '/home'

function normalizeHomePath(path: string | undefined): string {
  const value = String(path ?? '').trim()
  if (!value || !value.startsWith('/') || value.startsWith('//'))
    return DEFAULT_HOME_PATH
  return value
}

export const HOME_PATH = normalizeHomePath(import.meta.env.VITE_HOME_PATH)
export const FALLBACK_HOME_PATH = DEFAULT_HOME_PATH
