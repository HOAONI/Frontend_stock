/** 图标辅助工具，负责把图标名称转换为 Naive UI 可渲染节点。 */
import { Icon } from '@iconify/vue'
import { NIcon } from 'naive-ui'
import { resolveInlineSvgIcon } from './runtime-icon'

export function renderIcon(icon?: string, props?: import('naive-ui').IconProps) {
  if (!icon)
    return

  return () => createIcon(icon, props)
}

export function createIcon(icon?: string, props?: import('naive-ui').IconProps) {
  if (!icon)
    return

  let innerIcon: any
  const inlineSvg = resolveInlineSvgIcon(icon)

  if (inlineSvg) {
    innerIcon = h(NIcon, { ...props, innerHTML: inlineSvg })
  }
  else {
    innerIcon = h(NIcon, props, { default: () => h(Icon, { icon }) })
  }

  return innerIcon
}
