/** 应用入口负责创建 Vue 实例，并把根组件挂载到页面容器。 */
import App from './App.vue'

// 创建应用实例并挂载
const app = createApp(App)
app.mount('#app')
