import { vendoredRuntimeIconPathMap } from './runtime-icon.generated'

const localSvgIcons = import.meta.glob<string>('@/assets/svg-icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const vendoredRuntimeSvgIcons = import.meta.glob<string>('@/assets/runtime-icons/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const inlineSvgByPath: Record<string, string> = {
  ...localSvgIcons,
  ...vendoredRuntimeSvgIcons,
}

function resolveLocalIconPath(icon: string): string {
  const svgName = icon.replace('local:', '')
  return `/src/assets/svg-icons/${svgName}.svg`
}

function resolveVendoredRuntimeIconPath(icon: string): string | null {
  return vendoredRuntimeIconPathMap[icon as keyof typeof vendoredRuntimeIconPathMap] ?? null
}

export function resolveInlineSvgIcon(icon?: string): string | null {
  if (!icon)
    return null

  const path = icon.startsWith('local:')
    ? resolveLocalIconPath(icon)
    : resolveVendoredRuntimeIconPath(icon)

  if (!path)
    return null

  return inlineSvgByPath[path] ?? null
}
