/** UnoCSS 配置文件，集中维护原子化样式预设、快捷类和转换器。 */
import { defineConfig, presetAttributify, presetUno, transformerVariantGroup } from 'unocss'

// 官方文档：https://github.com/unocss/unocss

export default defineConfig({
  presets: [presetUno({ dark: 'class' }), presetAttributify()],
  shortcuts: {
    'wh-full': 'w-full h-full',
    'flex-center': 'flex justify-center items-center',
    'flex-col-center': 'flex-center flex-col',
    'flex-x-center': 'flex justify-center',
    'flex-y-center': 'flex items-center',
  },
  transformers: [
    transformerVariantGroup(),
  ],
})
