# Frontend_stock 项目导读

## 项目定位

这是一个基于 Vue 3、Vite、TypeScript、Naive UI 和 UnoCSS 的股票分析与交易后台前端。项目在通用后台模板的基础上，落了几条核心业务线：

- AI 分析中心：提交分析任务、查看运行队列、查看历史报告和阶段详情。
- AI 调度中心：查看调度健康、任务列表、任务详情和重试/重跑/取消等动作。
- 行情与策略展示：查看行情快照、K 线、指标和派生因子。
- 回测中心：同时支持策略回测与 Agent 回放。
- 交易账户中心：管理模拟盘绑定、资金变更、账户摘要和近期委托/成交。
- 系统与用户配置：后台配置管理、个人 AI/模拟盘/策略默认值配置。

如果你第一次接手这个项目，建议先看：

1. [src/main.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/main.ts)
2. [src/AppMain.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/AppMain.vue)
3. [src/router/guard.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/guard.ts)
4. [src/router/routes.static.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/routes.static.ts)
5. 对应业务页的 `views`、`store`、`services`、`api`、`types`

## 启动方式

### 环境要求

- Node.js：建议与项目当前依赖兼容的现代版本
- pnpm：项目脚本基于 pnpm

### 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
```

### 环境变量

环境变量声明在 [src/typings/env.d.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/typings/env.d.ts) 中，常用项如下：

- `VITE_BASE_URL`：前端部署基础路径
- `VITE_APP_NAME`：页面标题前缀
- `VITE_ROUTE_MODE`：路由模式，支持 `hash` / `web`
- `VITE_HOME_PATH`：登录后默认首页
- `VITE_COPYRIGHT_INFO`：底部版权文案
- `VITE_API_BASE_URL`：接口基础地址
- `VITE_API_TIMEOUT`：接口超时时间
- `VITE_DATA_MODE`：数据模式，影响真实接口/派生数据的使用策略
- `VITE_ENABLE_MOCK_BADGE`：是否展示模拟/派生数据标识
- `VITE_PROXY_TARGET`：本地开发代理指向的后端地址

`.env`、`.env.dev`、`.env.production` 里放的是不同环境的具体值；这类文件不适合在代码里写注释，所以统一在这里说明。

## 目录地图

### 启动与框架层

- [src/main.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/main.ts)：创建应用实例并挂载根组件
- [src/App.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/App.vue)：用 `Suspense` 承接异步初始化
- [src/AppMain.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/AppMain.vue)：按顺序注册 Pinia、路由、全局模块
- [src/router/index.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/index.ts)：创建路由实例并安装守卫
- [src/router/guard.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/guard.ts)：登录态、默认跳转、权限路由初始化
- [src/store/index.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/store/index.ts)：Pinia 和持久化插件安装

### 业务代码分层

- `src/views`：路由级页面，负责页面编排与局部状态组织
- `src/components`：可复用业务组件和通用组件
- `src/composables`：复杂页面逻辑与副作用收口
- `src/store`：跨页面状态，如登录态、菜单、交易账户快照
- `src/services`：面向业务场景的组装层，负责接口兼容和前端派生
- `src/api`：最薄的一层接口封装，只负责请求和字段转换
- `src/types`：业务类型定义，供 `api`、`store`、`views` 共用
- `src/utils`：纯工具函数
- `src/layouts`：壳层布局、头部、侧边栏、移动端抽屉
- `src/constants`：常量与设计令牌
- `src/directives`：权限、复制等自定义指令

## 页面入口

静态菜单和页面映射集中在 [src/router/routes.static.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/routes.static.ts)。

重要入口如下：

- 首页：[src/views/home/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/home/index.vue)
- 分析中心：[src/views/analysis/center/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/analysis/center/index.vue)
- 调度中心：[src/views/analysis/scheduler/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/analysis/scheduler/index.vue)
- 行情中心：[src/views/market/center/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/market/center/index.vue)
- 回测中心：[src/views/backtest/center/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/backtest/center/index.vue)
- 交易账户中心：[src/views/profile/trading/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/trading/index.vue)
- 个人配置：[src/views/profile/settings/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/settings/index.vue)
- 系统配置：[src/views/system/config/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/system/config/index.vue)
- 管理端用户：[src/views/admin/users/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/admin/users/index.vue)
- 管理端日志：[src/views/admin/logs/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/admin/logs/index.vue)

## 核心数据流

### 1. 启动链路

`main.ts` 创建应用后，会进入 `App.vue -> AppMain.vue`。`AppMain.vue` 在渲染主界面前完成三件事：

1. 安装 Pinia
2. 安装 Vue Router
3. 自动注册 `src/modules` 下的全局模块

这也是为什么首次打开项目时，先看 `AppMain.vue` 最容易建立整体感。

### 2. 登录与权限链路

- 会话状态由 [src/store/session.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/store/session.ts) 维护
- 路由守卫在 [src/router/guard.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/guard.ts)
- 菜单与真实路由转换逻辑在 [src/store/router/helper.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/store/router/helper.ts)

常见顺序是：

1. 守卫先检查后端会话是否可用
2. 未登录则跳到登录页，并携带 `redirect`
3. 已登录但权限路由尚未初始化时，动态注入业务路由
4. 注入后再继续原始导航

### 3. 业务请求链路

推荐按这条路径读：

`views -> composables/store -> services -> api -> client`

含义如下：

- `views` 关心页面区块、交互状态和组件组合
- `composables/store` 负责状态聚合、竞态控制、轮询/SSE、表单草稿
- `services` 负责兼容后端多版本字段、派生前端展示模型
- `api` 负责请求与驼峰转换
- `client.ts` 负责 Axios 基础能力和 401 跳转

### 4. 三条最值得先掌握的业务线

- 分析中心
  - 页面：[src/views/analysis/center/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/analysis/center/index.vue)
  - SSE：[src/composables/useTaskStream.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/composables/useTaskStream.ts)
  - 队列状态：[src/composables/useTaskQueueState.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/composables/useTaskQueueState.ts)
  - 接口：[src/api/analysis.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/api/analysis.ts)

- 调度中心
  - 页面：[src/views/analysis/scheduler/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/analysis/scheduler/index.vue)
  - 核心 composable：[src/composables/useSchedulerCenter.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/composables/useSchedulerCenter.ts)
  - 接口：[src/api/analysis-scheduler.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/api/analysis-scheduler.ts)
  - 视图模型：[src/types/analysis-scheduler-view.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/types/analysis-scheduler-view.ts)

- 交易账户中心
  - 页面：[src/views/profile/trading/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/trading/index.vue)
  - 视图模型：[src/views/profile/trading/composables/useTradingAccountCenterViewModel.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/trading/composables/useTradingAccountCenterViewModel.ts)
  - 状态：[src/store/trading-account.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/store/trading-account.ts)
  - 接口：[src/api/trading-account.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/api/trading-account.ts)

## 状态管理分工

- `useAppStore`
  - 管布局状态、页脚文案、页面软刷新
- `useSessionStore`
  - 管登录态、当前用户、角色权限、后端认证状态
- `useRouteStore`
  - 管原始路由、侧边菜单、当前高亮菜单
- `useBrokerAccountStore`
  - 管模拟盘绑定状态和 onboarding 弹窗
- `useTradingAccountStore`
  - 管交易账户摘要、明细、快照刷新和请求竞态
- `useUserSettingsStore`
  - 管用户配置归一化和本地缓存

## 常见修改入口

### 想新增一个后台菜单页面

1. 在 `src/views` 新建页面
2. 在 [src/router/routes.static.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/router/routes.static.ts) 增加路由项
3. 如果需要权限控制，补 `roles`、`requiresAuth`
4. 如果页面状态复杂，优先新建独立 `composable` 或 `store`

### 想改某个页面的数据来源

优先顺序是：

1. 看页面 `views`
2. 看它依赖的 `store` / `composable`
3. 看 `services` 是否做了兼容或派生
4. 最后才去改 `api`

不要直接在页面里硬写接口兼容逻辑，否则后续会很难维护。

### 想改系统配置项展示

先看：

- [src/views/system/config/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/system/config/index.vue)
- [src/utils/system-config-display.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/utils/system-config-display.ts)
- [src/types/system-config.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/types/system-config.ts)

### 想改交易账户卡片/表格展示

先看：

- [src/views/profile/trading/index.vue](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/trading/index.vue)
- [src/views/profile/trading/composables/useTradingAccountCenterViewModel.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/views/profile/trading/composables/useTradingAccountCenterViewModel.ts)
- 对应 `components/trading` 和 `views/profile/trading/components`

## 自动生成文件说明

以下文件不要手工直接改，改了也很容易被下次生成覆盖：

- [src/typings/auto-imports.d.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/typings/auto-imports.d.ts)
  - 来自自动导入插件
- [src/typings/components.d.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/typings/components.d.ts)
  - 来自组件自动注册插件
- [src/utils/runtime-icon.generated.ts](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/src/utils/runtime-icon.generated.ts)
  - 来自 [scripts/generate-runtime-icons.mjs](/Users/hoaon/Desktop/毕设相关/project/v4/Frontend_stock/scripts/generate-runtime-icons.mjs)

如果你要调整运行时图标，请改脚本或图标清单，然后重新执行：

```bash
pnpm icons:generate-runtime
```

## 注释约定

这次补的中文注释遵循以下原则：

- 文件头注释：说明这个文件负责什么、位于哪一层、上下游是谁
- 导出函数/类型注释：说明输入输出和页面为什么要依赖它
- 行内注释：只解释竞态、兼容、默认值、兜底和容易误解的判断
- 不做逐行翻译：能从代码直接看懂的赋值和模板结构，不重复制造噪音

如果后续继续维护，建议保持同样的风格：注释解释“为什么”，命名负责表达“是什么”。
