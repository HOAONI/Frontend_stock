/** Vite 构建配置入口，统一管理别名、代理、插件和构建选项。 */
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { createVitePlugins } from './build/plugins'

// 官方文档：https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 根据当前工作目录中的 `mode` 加载 .env 文件
  const env = loadEnv(mode, __dirname, '') as Record<string, string> & Partial<ImportMetaEnv>
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8002'

  return {
    base: env.VITE_BASE_URL,
    plugins: createVitePlugins(),
    resolve: {
      alias: {
        // 统一使用 `@` 指向源码根目录，减少深层相对路径。
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        // 本地开发默认把 API、OpenAPI 和文档请求都转发到后端服务。
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/openapi.json': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/docs': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'esnext',
      reportCompressedSize: false, // 启用/禁用 gzip 压缩大小报告
    },
    optimizeDeps: {
      // ECharts 体积较大，预构建可以减少首次开发启动抖动。
      include: ['echarts'],
    },
    css: {
      preprocessorOptions: {
        scss: {},
      },
    },
  }
})
