import type { App, Directive } from 'vue'

interface CopyHTMLElement extends HTMLElement {
  _copyText: string
}

export function install(app: App) {
  const { isSupported, copy } = useClipboard()
  const permissionWrite = usePermission('clipboard-write')

  function clipboardEnable() {
    if (!isSupported.value) {
      window.$message.error('当前浏览器不支持复制')
      return false
    }

    if (permissionWrite.value === 'denied') {
      window.$message.error('当前浏览器未授予剪贴板权限')
      return false
    }
    return true
  }

  function copyHandler(this: any) {
    if (!clipboardEnable())
      return
    copy(this._copyText)
    window.$message.success('已复制到剪贴板')
  }

  function updataClipboard(el: CopyHTMLElement, text: string) {
    el._copyText = text
    el.addEventListener('click', copyHandler)
  }

  const copyDirective: Directive<CopyHTMLElement, string> = {
    mounted(el, binding) {
      updataClipboard(el, binding.value)
    },
    updated(el, binding) {
      updataClipboard(el, binding.value)
    },
    unmounted(el) {
      el.removeEventListener('click', copyHandler)
    },
  }
  app.directive('copy', copyDirective)
}
