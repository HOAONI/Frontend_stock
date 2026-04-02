# Frontend_stock

`Frontend_stock` 是“AI 驱动的股票智能分析与模拟交易平台”的前端管理台，负责承载 AI 分析、任务调度、行情展示、策略回测、交易账户管理、个人配置与后台管理等核心界面能力。

它与 [Backend_stock](https://github.com/HOAONI/Backend_stock) 和 [Agent_stock](https://github.com/HOAONI/Agent_stock) 协同工作，组成完整的股票智能分析与模拟交易系统。

## 核心能力

- AI 分析中心：提交分析任务、查看执行状态、失败详情、历史记录与报告摘要
- 调度中心：展示任务队列、运行态信息、调度状态与异步执行链路
- Agent 问股：通过流式对话查看组合建议、候选订单和模拟盘执行结果
- 行情与策略展示：查看股票、市场信息和策略相关数据
- 回测与统计：触发策略回测，查看收益、持仓、订单、成交与 AI 解读
- 个人配置与交易账户中心：维护模拟盘、账户参数和个人偏好
- 后台管理：管理员可维护全局行情源、用户与日志

## 技术栈

- `Vue 3`
- `TypeScript`
- `Vite`
- `Pinia`
- `Vue Router`
- `Naive UI`
- `UnoCSS`
- `ECharts`
- `Axios`

## 页面与模块

当前前端主要页面和菜单包括：

- 首页
- AI 分析与调度
- 分析中心
- 调度中心
- 行情与策略展示
- 回测与统计
- 个人配置
- 交易账户中心
- 后台管理（配置管理 / 全局行情源、用户管理、日志管理）

接口层按业务拆分在 `src/api` 中，当前已覆盖分析、调度、回测、股票、交易账户、全局行情源、管理员日志与用户管理等模块。

## 关联服务

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8002`
- Agent: `http://127.0.0.1:8001`

前端默认通过 Vite 代理或显式 API 地址连接后端服务，完整系统需要与后端和 Agent 服务一起运行。

## 本地开发

### 依赖要求

- `Node.js 22+`
- `pnpm`

### 安装依赖

```bash
pnpm install
```

### 环境变量

推荐先复制模板：

```bash
cp .env.example .env
```

前端会读取以下变量：

```bash
VITE_APP_NAME=股票智能分析与模拟交易平台
VITE_BASE_URL=/
VITE_ROUTE_MODE=web
VITE_HOME_PATH=/home
VITE_COPYRIGHT_INFO=
VITE_API_BASE_URL=/
VITE_API_TIMEOUT=30000
VITE_DATA_MODE=hybrid
VITE_ENABLE_MOCK_BADGE=true
VITE_PROXY_TARGET=http://127.0.0.1:8002
VITE_BACKTEST_RUN_TIMEOUT=150000
```

### 启动开发服务

如果你在当前聚合工作区 `/Users/hoaon/Desktop/毕设相关/project/v4` 内联调，请优先回到工作区根目录执行：

```bash
bash scripts/system/start.sh
```

该脚本会统一启动 `Frontend_stock / Backend_stock / Agent_stock`，并同步 `AGENT_SERVICE_AUTH_TOKEN`、`VITE_PROXY_TARGET`、`VITE_API_BASE_URL` 等联调配置。`Agent 问股` 页面依赖三者同时可用，不建议分别手工启动。

只开发前端页面且不需要联调时，再单独运行：

```bash
pnpm dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

## 常用命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm preview
pnpm start
pnpm stop
```

其中：

- `pnpm dev`：启动 Vite 开发环境
- `pnpm build`：先执行类型检查，再构建生产包
- `pnpm typecheck`：执行 Vue/TypeScript 类型检查
- `pnpm lint`：执行 ESLint 和类型检查
- `pnpm start` / `pnpm stop`：使用仓库内脚本启动或停止前端进程

## 全链路运行说明

如果你是在一台空白机器上把 `Frontend_stock`、`Backend_stock`、`Agent_stock` 三个仓库克隆到同一父目录后做联调，请优先使用聚合工作区根目录的：

```bash
bash scripts/system/start.sh
```

如果需要从零搭建环境，再参考：

- [StockSystemHub 主安装文档](https://github.com/HOAONI/StockSystemHub/blob/main/INSTALL_FULL_STACK_FROM_SCRATCH.md)

## License

[MIT](LICENSE)
