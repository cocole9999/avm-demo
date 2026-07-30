# AVM 项目中心 — Code Wiki

> 本文档为 AVM 项目中心的完整代码 Wiki，覆盖项目整体架构、主要模块职责、关键类与函数说明、依赖关系以及项目运行方式等关键信息。
>
> - **项目名称**：AVM 项目中心（Around View Monitor 产品集成项目管理平台）
> - **业务背景**：面向吉利汽车 AVM 集成项目，管理需求/任务/缺陷/版本工作项、流程评审、资源排期、度量报表，并深度集成 AI 与 MCP 能力
> - **当前版本**：后端 `avm-backend@1.55.11` / 前端 `avm-frontend@1.55.17`

---

## 目录

- [1. 项目整体架构](#1-项目整体架构)
  - [1.1 架构总览](#11-架构总览)
  - [1.2 技术栈](#12-技术栈)
  - [1.3 顶层目录结构](#13-顶层目录结构)
- [2. 后端架构与模块职责](#2-后端架构与模块职责)
  - [2.1 入口与启动流程](#21-入口与启动流程)
  - [2.2 中间件层](#22-中间件层)
  - [2.3 路由层](#23-路由层)
  - [2.4 服务层（Services）](#24-服务层services)
  - [2.5 工具层（Utils）](#25-工具层utils)
  - [2.6 核心配置模块](#26-核心配置模块)
- [3. 前端架构与模块职责](#3-前端架构与模块职责)
  - [3.1 入口与路由](#31-入口与路由)
  - [3.2 主布局 App.tsx](#32-主布局-apptsx)
  - [3.3 API 客户端](#33-api-客户端)
  - [3.4 页面（Pages）](#34-页面pages)
  - [3.5 视图（Views）](#35-视图views)
  - [3.6 通用组件（Components）](#36-通用组件components)
  - [3.7 Hooks](#37-hooks)
  - [3.8 前端服务（services）](#38-前端服务services)
- [4. 数据模型](#4-数据模型)
- [5. 关键流程与依赖关系](#5-关键流程与依赖关系)
- [6. 项目运行方式](#6-项目运行方式)
- [7. 可观测性与运维](#7-可观测性与运维)

---

## 1. 项目整体架构

### 1.1 架构总览

AVM 项目中心采用经典的前后端分离 + 单体后端架构，并内置实时通信与 MCP 协议对外能力：

```
┌──────────────────────────────────────────────────────────────────┐
│                      浏览器 / MCP AI 客户端                        │
│         (Claude / Cursor / Trae / Cline 等支持 MCP 的工具)         │
└──────────────┬───────────────────────────────┬───────────────────┘
               │ HTTP (REST + SSE)             │ WebSocket
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  前端 (frontend/)  React 18 + Vite + Ant Design 5                │
│  ├─ 路由 / 主布局 / 主题 / 认证上下文                              │
│  ├─ 30+ 业务页面 + 4 种工作项视图                                  │
│  ├─ 全局 AI 助理 (Drawer) + Agent 面板 (Trae Work 风格)           │
│  └─ WebSocket 客户端 (实时通知/工作项变更刷新)                     │
└──────────────┬───────────────────────────────────────────────────┘
               │ /api  (Vite Proxy 或 Nginx 反代)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  后端 (backend/)  Node.js + Express + TypeScript + Prisma         │
│  ├─ 中间件: Sentry / Helmet / 限流 / Metrics / 鉴权 / CSRF        │
│  ├─ 45+ REST 路由 (工作项/流程/评审/AI/Agent/MCP/业务实体/系统)    │
│  ├─ 20+ 业务服务 (流程引擎/评审引擎/AI 引擎/LLM/自动化/...)        │
│  ├─ WebSocket Server (4001 端口, 实时通知推送)                    │
│  └─ MCP Server (HTTP+SSE / stdio, 暴露 124 个工具给外部 AI)       │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  数据层                                                           │
│  ├─ SQLite (开发演示, 单文件 backend/data.db)                     │
│  └─ PostgreSQL 16 (生产, 通过 schema.production.prisma 切换)       │
└──────────────────────────────────────────────────────────────────┘
```

**关键架构特点**：

1. **双数据库模式**：开发用 SQLite（易分发），生产用 PostgreSQL，仅通过 `DATABASE_URL` + schema 文件切换
2. **多端口分工**：HTTP API 在 `PORT`（默认 4000），WebSocket 在 `PORT+1`（默认 4001）
3. **AI 能力分层**：启发式规则引擎（`aiEngine`，无需 LLM 即可演示）+ LLM 抽象层（`llmProvider`，支持 10+ 厂商）+ MCP 协议对外（`mcpCore`，124 个工具）
4. **实时通知**：WebSocket 推送 + 多端登录支持（userId → Set<WebSocket>）
5. **生产加固**：CSP/CORP 收紧、bcrypt + 强密码、AES-256-GCM 加密凭证、Sentry 错误追踪、Prometheus 指标、审计日志、字段白名单防 Mass Assignment

### 1.2 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript + Vite 8（SWC 编译） |
| 前端 UI | Ant Design 5 + @ant-design/icons + antd-style |
| 前端路由 | react-router-dom 6 |
| 前端图表 | ECharts 6 + echarts-for-react |
| 前端拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 流程编排 | @xyflow/react（React Flow） |
| Markdown | react-markdown + remark-gfm + marked + dompurify |
| 前端监控 | @sentry/react |
| 后端框架 | Node.js + Express 4 + TypeScript 5 |
| ORM | Prisma 5（@prisma/client） |
| 数据库 | SQLite（开发）/ PostgreSQL 16（生产） |
| 认证 | bcryptjs + 自实现 Token（32 字节 hex） |
| 校验 | zod 4 |
| 日志 | winston 3 |
| 错误追踪 | @sentry/node 10 |
| 实时通信 | ws 8（WebSocket） |
| 文件处理 | multer + exceljs + pdf-parse + mammoth |
| API 文档 | swagger-ui-express + swagger-autogen |
| 测试 | Vitest 4（单元）+ Playwright（E2E）+ supertest |
| 部署 | Docker + docker-compose + Nginx |

### 1.3 顶层目录结构

```
avm-demo/
├── backend/                  # 后端服务
│   ├── prisma/               # Prisma schema 与迁移
│   │   ├── schema.prisma             # SQLite 开发 schema
│   │   ├── schema.production.prisma  # PostgreSQL 生产 schema
│   │   └── migrations/               # 数据库迁移
│   ├── src/
│   │   ├── bin/mcp-stdio.ts          # MCP stdio 入口
│   │   ├── middleware/               # 中间件 (auth/security/csrf/ownership)
│   │   ├── routes/                   # 45+ REST 路由
│   │   ├── services/                 # 20+ 业务服务
│   │   │   └── aiTools/              # AI 工具集 (按业务域拆分)
│   │   ├── utils/                    # 工具 (logger/crypto/audit/...)
│   │   ├── index.ts                  # 后端入口
│   │   ├── db.ts / env.ts / cache.ts / swagger.ts / constants.ts / seed.ts
│   ├── scripts/                      # 备份/恢复/swagger 生成脚本
│   ├── tests/                        # 单元测试
│   └── Dockerfile                    # 多阶段构建 (deps→build→runtime)
│
├── frontend/                 # 前端服务
│   ├── src/
│   │   ├── components/               # 通用组件
│   │   ├── pages/                    # 30+ 业务页面
│   │   ├── views/                    # 工作项视图 (表格/看板/甘特/列表)
│   │   ├── hooks/                    # 13 个自定义 Hook
│   │   ├── services/                 # WebSocket 客户端
│   │   ├── utils/                    # 前端工具
│   │   ├── constants/                # 枚举/分页常量
│   │   ├── App.tsx / Root.tsx / main.tsx
│   │   ├── AuthContext.tsx / ThemeContext.tsx
│   │   ├── api.ts                    # API 客户端 (按域分组)
│   │   └── types.ts                  # 全局类型定义
│   ├── nginx.conf                    # 生产 Nginx 配置 (含 /api 反代)
│   └── Dockerfile                    # build → nginx 静态服务
│
├── e2e/                      # 根级 Playwright E2E 测试
├── monitoring/               # Prometheus + Loki + Grafana 监控栈
├── perf/                     # k6 / autocannon 性能测试
├── scripts/                  # 辅助脚本
├── docker-compose.yml        # 一键起 postgres + backend + frontend + backup
├── .env.example              # 环境变量模板
└── README.md / DEPLOY.md / MCP_SETUP.md / MONITORING.md / USER_GUIDE.md
```

---

## 2. 后端架构与模块职责

### 2.1 入口与启动流程

**文件**：[backend/src/index.ts](file:///workspace/backend/src/index.ts)

后端启动顺序（顺序很重要，部分依赖前置初始化）：

1. `validateProductionEnv()` — 生产环境强制校验 CORS_ORIGIN / API_KEY_ENCRYPTION_KEY，缺失则拒绝启动
2. `initSentry()` + `setupSentryExpressHandlers(app)` — Sentry 必须最早初始化以捕获后续错误
3. 挂载 `helmetMiddleware`（安全头/CSP）+ `globalLimiter`（限流）
4. 挂载 `metricsMiddleware` + 暴露 `/metrics`（Prometheus 抓取，不走鉴权）
5. CORS（生产限制 origin）+ JSON body 解析（100MB 上限）
6. `morgan` 结构化访问日志（dev 彩色 / 生产标准格式，写 winston）
7. 静态文件服务 `/uploads`（评论图片）
8. 挂载 `healthRouter`（健康检查，不走鉴权）
9. 挂载 `requireAuth` 全局鉴权（白名单放行登录/health/SSO）
10. 可选 CSRF 保护（`ENABLE_CSRF_PROTECTION=true`）
11. 挂载 Swagger（`/api-docs`，可通过 `ENABLE_API_DOCS=false` 关闭）
12. 挂载 45+ 业务路由（watchRouter 必须在 workItemRouter 之前，避免 `/:id` 拦截）
13. Sentry 错误处理器 + 全局错误处理中间件（5xx 上报 + 触发告警，生产脱敏）
14. `app.listen(PORT)` — 启动 HTTP 服务并启动 `startRiskScanner()` 定时风险扫描
15. `httpServer.listen(PORT+1)` — 启动 WebSocket 服务并 `attachWsServer`
16. 注册 `uncaughtException` / `unhandledRejection` / `SIGTERM` / `SIGINT` 处理（优雅关闭）

**关键导出**：
- `wsPush` — 暴露给路由层使用的 WebSocket 推送 helper（`toUser` / `toAll` / `toRole` / `stats`）

### 2.2 中间件层

**目录**：[backend/src/middleware/](file:///workspace/backend/src/middleware/)

| 文件 | 职责 | 关键导出 |
|---|---|---|
| [auth.ts](file:///workspace/backend/src/middleware/auth.ts) | 鉴权 + 角色控制 | `requireAuth`（全局鉴权，dev 无 token 注入 dev-user，生产 401）、`requireRole(minRole)`（角色门槛）、`autoRole()`（GET 放行 / DELETE 需 tenant_admin / 其他写需 space_admin）、`ROLE_LEVEL`（member=0/space_admin=1/tenant_admin=2） |
| [ownership.ts](file:///workspace/backend/src/middleware/ownership.ts) | 资源所有权校验（防 IDOR） | `requireWorkItemOwnership()`、`requireProjectOwnership()` — tenant_admin 全过，space_admin 查空间管理员，member 查 reporter/assignee/createdBy |
| [security.ts](file:///workspace/backend/src/middleware/security.ts) | 安全头 + 限流 | `helmetMiddleware`（生产严格 CSP + CORP）、`globalLimiter`（全局 API 限流）、`loginLimiter`（登录端点限流，跳过成功请求） |
| [csrf.ts](file:///workspace/backend/src/middleware/csrf.ts) | CSRF 保护（可选） | `csrfProtection`、`getCsrfToken` — 内存 Map 存储 token，`timingSafeEqual` 防时序攻击；JWT Bearer 场景通常不需要 |

**鉴权四层防护**：`requireAuth`（是否登录）→ `requireRole`（角色门槛）→ `requireXxxOwnership`（资源所有权）→ 字段白名单（防 Mass Assignment）

### 2.3 路由层

**目录**：[backend/src/routes/](file:///workspace/backend/src/routes/)

按业务域分组（每个路由文件挂载在 `/api/<resource>`）：

**工作项核心域**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [workItems.ts](file:///workspace/backend/src/routes/workItems.ts) | `/api/work-items` | 工作项 CRUD + 列表筛选 + 状态流转 + 批量操作 + 关联管理 + 甘特数据 + 负荷统计 |
| [iterations.ts](file:///workspace/backend/src/routes/iterations.ts) | `/api/iterations` | 迭代（Sprint）CRUD + 燃尽图 + 回顾数据 |
| [comments.ts](file:///workspace/backend/src/routes/comments.ts) | `/api/comments` | 评论 CRUD + @提及解析通知 + reactions + 关注者新评论通知 |
| [activities.ts](file:///workspace/backend/src/routes/activities.ts) | `/api/activities` | 工作项活动流查询 |
| [tree.ts](file:///workspace/backend/src/routes/tree.ts) | `/api/tree` | 树形视图，按父子层级组织工作项 |
| [dependencies.ts](file:///workspace/backend/src/routes/dependencies.ts) | `/api/dependencies` | V1.7.1 外部依赖管理（台架/实车/车模/SDB/UE/UI/标定）CRUD + 标记就绪 |
| [watch.ts](file:///workspace/backend/src/routes/watch.ts) | `/api/work-items` | V1.50 工作项关注/取消关注/关注者列表/我关注的 |
| [savedFilters.ts](file:///workspace/backend/src/routes/savedFilters.ts) | `/api/saved-filters` | V1.52 团队共享筛选器 CRUD |

**流程 / 评审 / 字段域**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [flows.ts](file:///workspace/backend/src/routes/flows.ts) | `/api/flows` | 节点流查询/激活切换，委托 `flowEngine` |
| [reviews.ts](file:///workspace/backend/src/routes/reviews.ts) | `/api/reviews` | 评审发起/列表/详情/决策，委托 `reviewEngine` |
| [fields.ts](file:///workspace/backend/src/routes/fields.ts) | `/api/fields` | 公式字段 + 聚合字段 CRUD + 派生值查询，委托 `formulaEngine`/`rollupEngine` |
| [templates.ts](file:///workspace/backend/src/routes/templates.ts) | `/api/templates` | 工作项模板库（按使用频次排序） |

**可视化 / 工作台 / 搜索域**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [charts.ts](file:///workspace/backend/src/routes/charts.ts) | `/api/charts` | 图表配置 CRUD + 计算 + 预览 |
| [dashboards.ts](file:///workspace/backend/src/routes/dashboards.ts) | `/api/dashboards` | 仪表盘 CRUD |
| [workbench.ts](file:///workspace/backend/src/routes/workbench.ts) | `/api/workbench` | 个人工作台聚合（我负责的/临期/4 大指标） |
| [search.ts](file:///workspace/backend/src/routes/search.ts) | `/api/search` | 全局跨实体搜索 + 联想 |
| [meta.ts](file:///workspace/backend/src/routes/meta.ts) | `/api/meta` | 元数据（类型/状态/优先级选项 + 已用 assignee/module）+ 全局统计 + 健康分布 |

**AI 相关路由**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [ai.ts](file:///workspace/backend/src/routes/ai.ts) | `/api/ai` | AI 字段级能力（估分/归类/优先级/风险/问答/拆解/周报），委托 `aiEngine` |
| [aiCommand.ts](file:///workspace/backend/src/routes/aiCommand.ts) | `/api/ai-command` | 自然语言命令端点，LLM function calling 自主调工具，结合 Wiki 知识 + 项目快照 |
| [agent.ts](file:///workspace/backend/src/routes/agent.ts) | `/api/agent` | V1.44 `/` 命令触发式 Agent（listCommands/searchCommands/executeAgentCommand） |
| [agents.ts](file:///workspace/backend/src/routes/agents.ts) | `/api/agents` | V1.55 Agent 配置 CRUD + seed 重置 6 个内置 Agent |
| [agentSessions.ts](file:///workspace/backend/src/routes/agentSessions.ts) | `/api/agent-sessions` | V1.55 Agent 会话 CRUD + Fork + append 消息 |
| [agentFeedback.ts](file:///workspace/backend/src/routes/agentFeedback.ts) | `/api/agent-feedback` | V1.55 Agent 反馈（up/down）幂等提交 + 统计 |
| [mcp.ts](file:///workspace/backend/src/routes/mcp.ts) | `/api/mcp` | MCP Server HTTP+SSE 端点（Streamable HTTP + Legacy），委托 `mcpCore` |
| [llmSettings.ts](file:///workspace/backend/src/routes/llmSettings.ts) | `/api/llm-settings` | LLM Provider 设置 CRUD + 测试连接 + 主 provider 标记 + 模型切换（apiKey 落库前 AES-256-GCM 加密） |

**业务实体域（吉利 AVM 集成项目）**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [projects.ts](file:///workspace/backend/src/routes/projects.ts) | `/api/projects` | AVM 集成项目管理（绑定客户+车型，含合同类型/金额/预算/风险/进度），字段白名单防 Mass Assignment |
| [customers.ts](file:///workspace/backend/src/routes/customers.ts) | `/api/customers` | 客户档案（吉利各车型项目组），LRU 缓存 |
| [carModels.ts](file:///workspace/backend/src/routes/carModels.ts) | `/api/car-models` | 车型库（吉利全系：银河/极氪/领克/博越/熊猫/星瑞） |
| [contacts.ts](file:///workspace/backend/src/routes/contacts.ts) | `/api/contacts` | 联系人管理（UPL/PPM/测试/开发/AVM 接口人） |

**系统管理 / 协作域**

| 路由文件 | 挂载路径 | 职责 |
|---|---|---|
| [users.ts](file:///workspace/backend/src/routes/users.ts) | `/api/users` | 用户 CRUD + 登录（`loginLimiter`）+ bcrypt + 强密码校验 |
| [spaces.ts](file:///workspace/backend/src/routes/spaces.ts) | `/api/spaces` | 多空间管理 + 成员 |
| [notifications.ts](file:///workspace/backend/src/routes/notifications.ts) | `/api/notifications` | 通知中心 + 自动检测临期/超期 + 批量已读 |
| [favorites.ts](file:///workspace/backend/src/routes/favorites.ts) | `/api/favorites` | 个人收藏（按 folder 分组） |
| [resources.ts](file:///workspace/backend/src/routes/resources.ts) | `/api/resources` | 人员排期与负荷（时间窗聚合 + 甘特 + 热力图） |
| [mentions.ts](file:///workspace/backend/src/routes/mentions.ts) | `/api/mentions` | @联想搜索用户 |
| [handover.ts](file:///workspace/backend/src/routes/handover.ts) | `/api/handover` | 工作移交（批量转交） |
| [automation.ts](file:///workspace/backend/src/routes/automation.ts) | `/api/automation` | 无代码自动化引擎（触发器→条件→操作）+ 手动触发/测试/日志 |
| [webhooks.ts](file:///workspace/backend/src/routes/webhooks.ts) | `/api/webhooks` | WebHook 出站触发 + `/inbox/:token` 入站接收（URL token 鉴权） |
| [imports.ts](file:///workspace/backend/src/routes/imports.ts) | `/api/imports` | 数据导入 5 步向导（资源/模板/预览映射/执行/进度） |
| [tests.ts](file:///workspace/backend/src/routes/tests.ts) | `/api/tests` | 测试管理（用例库 + 计划 + 执行 + 缺陷关联） |
| [analysis.ts](file:///workspace/backend/src/routes/analysis.ts) | `/api/analysis` + `/api/baselines` | AI 人力分析 + 基线管理（实时分析 + 历史 + 对比） |
| [auditLogs.ts](file:///workspace/backend/src/routes/auditLogs.ts) | `/api/audit-logs` | 全系统审计日志查询 + 统计（space_admin 及以上可读） |
| [sso.ts](file:///workspace/backend/src/routes/sso.ts) | `/api/sso` | 企业版 SSO（Tenant + SSOSetting + 飞书 OAuth 跳转/回调 + 登录日志） |
| [uploads.ts](file:///workspace/backend/src/routes/uploads.ts) | `/api/uploads` | 评论图片上传（multer + mime 白名单） |
| [upload.ts](file:///workspace/backend/src/routes/upload.ts) | `/api/upload` | 通用文件上传 + 解析（`/file`/`/image`/`/types`） |
| [export.ts](file:///workspace/backend/src/routes/export.ts) | `/api/export` | 数据导出 Excel/CSV（space_admin 及以上） |
| [health.ts](file:///workspace/backend/src/routes/health.ts) | `/api/health` | 健康检查（基础 + `/deep` 探测 DB） |

### 2.4 服务层（Services）

**目录**：[backend/src/services/](file:///workspace/backend/src/services/)

#### 业务流程服务

**[flowEngine.ts](file:///workspace/backend/src/services/flowEngine.ts)** — 流程引擎
节点流（NodeFlow）全生命周期管理：节点流 CRUD、工作项流转、状态机校验、DOD 校验、入口/出口条件校验。

| 导出 | 说明 |
|---|---|
| `getActiveFlow(workType)` | 获取某工作项类型的活跃节点流 |
| `saveFlow(data)` | 创建/保存节点流（事务性整体替换 nodes + transitions） |
| `initWorkItemNode(workItemId, workType)` | 工作项创建时初始化起始节点 |
| `transitionWorkItem(workItemId, toNodeId, options)` | **核心**：工作项流转，含 transition 合法性 + DOD 校验 + 记录活动 |
| `getAvailableTransitions(workItemId)` | 获取工作项可流转的目标节点 |
| `getNodeByStatus(workType, status)` | 根据 status 找到对应节点 |

**[reviewEngine.ts](file:///workspace/backend/src/services/reviewEngine.ts)** — 评审引擎
TR/DCP/QR 评审全流程管理。

| 导出 | 说明 |
|---|---|
| `createReview(data)` | 发起评审（创建评审 + 要素 + 参与者） |
| `submitReviewItems(reviewId, userId, submissions)` | 参与者提交要素，自动检测全员完成并更新状态 |
| `finalizeReview(reviewId, data)` | 总结论，根据要素规则计算 go/not_go/go_with_risk |
| `listReviewTemplates()` / `createReviewTemplate(data)` | 评审模板查询/创建 |

**[formulaEngine.ts](file:///workspace/backend/src/services/formulaEngine.ts)** — 公式引擎 V2
沙箱化 DSL，支持数字/日期/字符串/类型转换/统计。

| 导出 | 说明 |
|---|---|
| `FIELD_REGISTRY` | 字段注册表（约 25 个字段） |
| `NUMBER_FUNCTIONS` / `STRING_FUNCTIONS` / `DATE_FUNCTIONS` | 内置函数集（约 40 个：SUM/AVG/MAX/MIN/IF/CONCAT/DAYS/DATE_DIFF 等） |
| `evaluateFormula(formula, ctx)` | 评估公式（tokenizer + 递归下降 parser） |
| `computeFormulaField(formulaFieldId)` | 计算某公式字段在所有工作项上的值并缓存 |
| `getFormulaMeta()` | 返回字段/函数元信息 |

**[rollupEngine.ts](file:///workspace/backend/src/services/rollupEngine.ts)** — 聚合引擎
子工作项 sum/avg/max/min/count + 完成度统计。

| 导出 | 说明 |
|---|---|
| `computeRollupField(rollupFieldId)` | 计算某聚合字段在所有父工作项上的值 |
| `computeItemDerivedFields(workItemId)` | 综合计算公式 + 聚合 |
| `recomputeAllDerivedFields(spaceId?)` | 批量重算所有派生字段 |

**[importEngine.ts](file:///workspace/backend/src/services/importEngine.ts)** — 导入引擎
支持 8 种资源导入，含字段映射、默认值、验证、错误收集。

| 导出 | 说明 |
|---|---|
| `autoMap(csvColumns, resource)` | 智能猜测 CSV 列名 → 数据库字段映射 |
| `generateTemplate(resource)` | CSV 模板生成 |
| `processImport(jobId, data, opts)` | 实际执行导入，每 10 行更新进度 |
| `FIELD_ALIASES` / `RESOURCE_ALIASES` / `RESOURCE_FIELDS` | 别名与字段定义 |

**[baselineEngine.ts](file:///workspace/backend/src/services/baselineEngine.ts)** — 基线引擎
计划快照 + 实际对比。

| 导出 | 说明 |
|---|---|
| `createBaseline(data)` | 创建基线（快照当前工作项状态） |
| `compareBaseline(baselineId)` | 对比基线 vs 现状，返回 9 类变更 + 健康分统计 |

**[projectSnapshot.ts](file:///workspace/backend/src/services/projectSnapshot.ts)** — 项目快照
把全量项目数据打包成结构化文本喂给 LLM 作为 system prompt 上下文，避免 LLM 幻觉。

| 导出 | 说明 |
|---|---|
| `buildProjectSnapshot()` | 并发查询所有实体，输出 4 大段（项目/客户/车型/工作项统计，约 2-3k tokens） |

#### AI 智能化服务

**[aiEngine.ts](file:///workspace/backend/src/services/aiEngine.ts)** — AI 启发式引擎
演示版 AI 引擎，基于规则和历史数据，可通过 `enhanceWithLLM` 接入真实 LLM 增强结果。

| 导出 | 说明 |
|---|---|
| `suggestEstimate(data)` | 估分建议，基于历史相似工作项加权平均 |
| `classifyBug(data)` | 缺陷归类，基于关键字规则匹配（9 大类别） |
| `suggestPriority(data)` | 优先级建议（P0/P1/P2） |
| `assessRisk(data)` | 风险评估，综合排期/工时/阻塞/子项/P0 未指派等维度 |
| `smartQA(question)` | 智能问答，正则模式匹配 + 数据查询 + 兜底相似搜索 |
| `generateWeeklyReport(userName)` | 个人周报生成 |
| `enhanceWithLLM(baseResult, prompt, context)` | LLM 增强器，注入项目快照 + Wiki 知识，失败时静默返回原结果 |
| `llmStatus()` | 查询 LLM 状态 |

**[aiTools.ts](file:///workspace/backend/src/services/aiTools.ts)** + **[aiToolsExt.ts](file:///workspace/backend/src/services/aiToolsExt.ts)** + **[aiToolsQuery.ts](file:///workspace/backend/src/services/aiToolsQuery.ts)** — AI 工具集
让 LLM 通过 function calling 操作 AVM 数据，共 124 个工具。

| 导出 | 说明 |
|---|---|
| `TOOLS` | 全部工具数组（9 核心 + 18 扩展 + 97 查询 = 124） |
| `toolsToOpenAIFormat()` | 转换为 OpenAI function calling 格式 |
| `executeTool(name, args)` | 统一工具执行入口 |

**[aiTools/](file:///workspace/backend/src/services/aiTools/)** — V1.46.2 重构后的查询类工具集（按业务域拆分）

| 文件 | 职责 |
|---|---|
| `types.ts` | `ToolDefinition` 接口 |
| `index.ts` | 汇总入口，聚合 `QUERY_TOOLS`（约 97 个） |
| `workItems.ts` | 工作项核心工具 |
| `projects.ts` | 项目实体工具 |
| `flowReview.ts` | 流程与评审工具 |
| `activityTest.ts` | 活动与测试工具 |
| `dashboard.ts` | 仪表盘与图表工具 |
| `system.ts` | 系统管理工具（约 23 个） |
| `config.ts` | 配置类工具（自动化/webhook/模板/公式/聚合，约 18 个） |
| `resources.ts` | 资源与基线工具（约 11 个） |
| `aiSettings.ts` | AI 设置与报告工具 |

**[llmProvider.ts](file:///workspace/backend/src/services/llmProvider.ts)** — LLM 抽象层
支持 OpenAI / Anthropic / DeepSeek / Qwen / GLM / Moonshot / Doubao / MiniMax / Ollama / 自定义等主流大模型，按 DB > 环境变量 > Mock 优先级解析配置。

| 导出 | 说明 |
|---|---|
| `OpenAICompatibleProvider` / `AnthropicProvider` / `MockProvider`（类） | 各 provider 实现，支持 function calling |
| `PROVIDERS` | 全部 provider 元数据（含模型列表、能力标识） |
| `getLLMProvider()` | 获取当前 provider |
| `getLLMStatus()` | 实时获取 LLM 配置状态 |
| `getAvailableModels(providerKey)` | 列出某 provider 的预置 + 自定义模型 |
| `testProvider(provider, config)` | 测试连接 |
| `modelSupportsVision(model)` | 判断模型是否支持视觉输入 |
| `clearLLMCache()` | 清除 30s 缓存 |

**[mcpCore.ts](file:///workspace/backend/src/services/mcpCore.ts)** — MCP Server 核心
V1.47 重构后从 `aiTools` 全量桥接 124 个工具，支持 HTTP+SSE 模式和 stdio 模式。

| 导出 | 说明 |
|---|---|
| `MCP_TOOLS` | 缓存的工具列表 |
| `executeTool(name, args, ctx?)` | 工具执行分发器 |
| `listResources()` / `readResource(uri)` | 资源（work-item URI）查询 |
| `handleJsonRpcRequest(req, ctx?)` | JSON-RPC 2.0 统一处理器 |
| `PROMPT_TEMPLATES` | 4 个内置 prompt 模板（每日站会/迭代回顾/风险评估/新人入职） |

**[nlSearch.ts](file:///workspace/backend/src/services/nlSearch.ts)** — 自然语言搜索
V1.53 基于规则的自然语言搜索，不依赖 LLM。

| 导出 | 说明 |
|---|---|
| `ruleBasedNlSearch(q)` | 规则解析（识别 target/优先级/类型/时间窗/延期/阻塞/负责人/关键词） |
| `buildSearchUrl(target, filters)` | 拼接 URL 参数到对应页面 |

**[wikiKnowledge.ts](file:///workspace/backend/src/services/wikiKnowledge.ts)** — Wiki 知识库
加载 `/wiki` 目录的 MD 内容拼成结构化文本喂给 LLM，5 分钟缓存。

| 导出 | 说明 |
|---|---|
| `loadWikiKnowledge()` | 加载并提取摘要（去 frontmatter/markdown 标记，限 500 字） |

**[agentCommands.ts](file:///workspace/backend/src/services/agentCommands.ts)** — Agent 命令系统
V1.44 参照 Trae Work Agent 模式的插件式架构。

| 导出 | 说明 |
|---|---|
| `registerCommand(cmd)` | 注册命令（支持别名） |
| `executeAgentCommand(commandName, args, ctx)` | 执行入口 |
| 内置命令 | `create-work-item` / `analyze-project` / `risk-scan` / `weekly-report` / `suggest-assignee` / `decompose` / `dashboard` / `help` |

**[agentPrompts.ts](file:///workspace/backend/src/services/agentPrompts.ts)** — Agent Prompts
V1.55 6 个内置 Agent system prompt 模板（general/project/workItem/report/risk/review）。

| 导出 | 说明 |
|---|---|
| `AGENT_PROMPTS` | 6 个内置 Agent prompt 模板 |
| `findAgentPrompt(key)` | 根据 key 查找模板 |

#### 自动化与通知服务

**[automationEngine.ts](file:///workspace/backend/src/services/automationEngine.ts)** — 无代码自动化引擎
触发器 → 条件 → 操作三段式规则执行。

| 导出 | 说明 |
|---|---|
| `TRIGGERS` / `CONDITIONS` / `ACTIONS` | 触发器（约 40 种）/ 条件（约 22 个字段）/ 操作（约 17 种）定义 |
| `runAutomation(rule, context)` | 执行自动化规则，含条件评估、操作执行、写日志、更新统计 |
| `testRule(rule, context)` | 干跑（不写实际数据），返回条件评估和操作预览 |

**[webhookEngine.ts](file:///workspace/backend/src/services/webhookEngine.ts)** — Webhook 引擎
事件驱动 Webhook 触发器，按 URL 智能识别飞书/钉钉/企微并自动转换 payload 格式。

| 导出 | 说明 |
|---|---|
| `triggerWebhooks(event, payload, configs?)` | 触发所有匹配的 webhook |
| 内部 | `detectIMChannel(url)`、`toFeishuCard`/`toDingtalkMarkdown`/`toWechatWorkMarkdown`、`sendWebhook`（HMAC-SHA256 签名 + 10s 超时 + 写日志） |

**[alertEngine.ts](file:///workspace/backend/src/services/alertEngine.ts)** — 系统告警引擎
V1.30.3 系统级告警通道，与业务 webhook 分离。

| 导出 | 说明 |
|---|---|
| `sendAlert(payload, channels)` | 发送告警（5 分钟去重 + 多通道 + 持久化） |
| `alertOnServerError(error, context)` | 5xx 错误率告警 |
| `alertOnHealthFail(component, details)` | 健康检查失败告警 |
| `alertOnEngineError(engine, error)` | AI/Webhook/Automation 引擎异常告警 |

**[riskScanner.ts](file:///workspace/backend/src/services/riskScanner.ts)** — 风险扫描器
AI 智能预警服务，定期扫描项目风险，LLM 总结成预警卡片，写入 Notification 中心推送，24 小时去重。

| 导出 | 说明 |
|---|---|
| `runRiskScan(trigger)` | 核心扫描函数（调 `scan_risks` 工具 → LLM 总结 → 24h 去重 → 写通知） |
| `startRiskScanner()` | 启动定时任务（启动 60s 后跑一次，然后每 1 小时） |
| `stopRiskScanner()` | 停止定时任务（测试用） |

**[wsServer.ts](file:///workspace/backend/src/services/wsServer.ts)** — WebSocket Server
V1.15 实时通知推送服务，维护 userId → Set<WebSocket> 映射（多端登录）。

| 导出 | 说明 |
|---|---|
| `attachWsServer(server, path)` | 附加到 HTTP server，处理 upgrade、token 验证、30s 心跳 |
| `pushToUser(userId, payload)` | 推送给指定用户的所有连接 |
| `broadcastAll(payload)` | 广播给所有连接 |
| `pushToRole(role, payload)` | 推送给指定角色的所有用户 |
| `getStats()` | 当前在线连接统计 |

#### 分析服务

**[resourceAnalysisEngine.ts](file:///workspace/backend/src/services/resourceAnalysisEngine.ts)** — 资源分析引擎
AI 人力分析，跨人员/项目/时间窗的人力风险评估。

| 导出 | 说明 |
|---|---|
| `analyzeResources(startDate, endDate, spaceId?)` | 核心分析函数，9 步流程：取排期 → 取活跃项 → 算工作日 → 按人聚合 → 补充活跃项 → 算利用率+风险评级（>120% overload / >80% busy / <30% idle）→ 团队级风险 → 健康分（0-100）→ 智能建议 |
| `saveAnalysis(spaceId, startDate, endDate, result)` | 缓存到数据库 |

### 2.5 工具层（Utils）

**目录**：[backend/src/utils/](file:///workspace/backend/src/utils/)

| 文件 | 职责 |
|---|---|
| [apiError.ts](file:///workspace/backend/src/utils/apiError.ts) | 统一 API 错误处理：`extractApiError` 提取 message/code/stack，`notifyApiError` 返回 500（生产脱敏），`notifyClientError` 处理 4xx |
| [audit.ts](file:///workspace/backend/src/utils/audit.ts) | 审计日志工具：`recordAudit` fire-and-forget 写库；`diffFields` 字段级 diff；`audit(entity, action)` 中间件 + `flush(req, extra)`；覆盖 27 种实体 + 15 种动作 |
| [cache.ts](file:///workspace/src/utils/cache.ts) | 通用内存缓存（`MemoryCache` 类，默认 5 分钟 TTL） |
| [crypto.ts](file:///workspace/backend/src/utils/crypto.ts) | AES-256-GCM 认证加密，存储格式 `enc:v1:iv:tag:ct`；旧明文值透明识别；生产环境无 key 直接拒绝启动 |
| [logger.ts](file:///workspace/backend/src/utils/logger.ts) | winston 结构化日志：dev 彩色，生产 JSON 行；输出 stdout + 生产额外写 error.log/combined.log（10MB 轮转）；提供 authLogger/dbLogger/apiLogger/aiLogger 子 logger |
| [mentions.ts](file:///workspace/backend/src/utils/mentions.ts) | 提及解析 + 通知：`parseMentions` 正则提取 @username；`resolveMentions` 精确+模糊匹配 user；`notifyMentions` 入库 + WS 推送 + webhook；`toFeishuMarkdown` 飞书卡片 |
| [metrics.ts](file:///workspace/backend/src/utils/metrics.ts) | 轻量 Prometheus 指标（不引入 prom-client）：HTTP 请求计数/耗时直方图、Node 进程内存/CPU/uptime、慢查询/DB 错误计数；自实现 exposition format 输出 `/metrics` |
| [notifyWatchers.ts](file:///workspace/backend/src/utils/notifyWatchers.ts) | 关注者通知：`notifyStatusChange` + `notifyNewComment`，排除触发人自己 |
| [password.ts](file:///workspace/backend/src/utils/password.ts) | bcrypt 密码哈希（cost 来自 env.BCRYPT_ROUNDS），兼容旧 SHA256+静态盐，验证通过自动标记 needUpgrade |
| [passwordPolicy.ts](file:///workspace/backend/src/utils/passwordPolicy.ts) | 密码强度校验：长度 8-128、必须含数字+字母、Top 100 弱密码黑名单、不允许与 username 相同 |
| [retry.ts](file:///workspace/backend/src/utils/retry.ts) | `withRetry`（指数退避）、`withTimeout`、`withDbRetry`（针对 Prisma P1001/P1002 等错误重试） |
| [sentry.ts](file:///workspace/backend/src/utils/sentry.ts) | Sentry 错误追踪：仅配置 SENTRY_DSN 时启用；PII 递归脱敏（26 个敏感 key → [REDACTED]）；性能采样 5% |
| [validation.ts](file:///workspace/backend/src/utils/validation.ts) | 基于 zod 的输入校验：覆盖工作项/项目/用户/评论/迭代/租户/SSO/LLM 设置/导出等 schema；`validateBody` + `validateQuery` 中间件 |

### 2.6 核心配置模块

| 文件 | 职责 |
|---|---|
| [constants.ts](file:///workspace/backend/src/constants.ts) | 工作项元数据常量：`STATUS_BY_TYPE`（4 种工作项类型的状态机，含 values/initial/terminal）、`PRIORITY_OPTIONS`(P0-P3)、`SEVERITY_OPTIONS`(S0-S3)、`TYPE_OPTIONS`、`TYPE_PREFIX`(REQ/TASK/BUG/REL)、`RELATION_TYPES`、`TYPE_LABEL`、`PRIORITY_COLOR`/`SEVERITY_COLOR`/`STATUS_COLOR` |
| [db.ts](file:///workspace/backend/src/db.ts) | Prisma 客户端封装：自动追加 PG 连接池参数、慢查询/错误记录（$extends 包装）、生产只记 model/action 不打印 query 明文防 PII 泄露 |
| [env.ts](file:///workspace/backend/src/env.ts) | 集中环境变量管理：`env` 对象（LLM/飞书/DATABASE_URL/PORT/安全配置等）、`validateProductionEnv()`（生产强制校验 CORS_ORIGIN + API_KEY_ENCRYPTION_KEY）、`validateSeedPassword()`（生产禁止默认演示密码） |
| [cache.ts](file:///workspace/backend/src/cache.ts) | 业务 LRU 缓存：`TTLCache<T>` 类、`caches` 单例（projects/customers/carModels/contacts/spaces 5min、users 10min、workItemTypes 10min）、`withCache` 包装器；不用 Redis（部署简单） |
| [swagger.ts](file:///workspace/backend/src/swagger.ts) | Swagger UI 配置：读取 `swagger-output.json`，挂载 `/api-docs` + `/api-docs.json`，不存在时降级为最小 spec |
| [seed.ts](file:///workspace/backend/src/seed.ts) | 种子数据：**生产环境禁止运行**。清空所有表后创建 7 用户 + 2 空间 + 6 客户 + 10 车型 + 30 联系人 + 7 项目 + 3 节点流 + 3 评审模板 + 3 迭代 + 17+ 工作项 + 12 外部依赖 + 5 测试用例 + 4 AI 字段配置 + 2 仪表盘 + 6 图表 + 通知/收藏/排期/公式/聚合/模板/自动化/webhook |
| [bin/mcp-stdio.ts](file:///workspace/backend/src/bin/mcp-stdio.ts) | MCP stdio 入口：从 `AVM_MCP_TOKEN` env 解析用户上下文，按行缓冲 stdin → JSON.parse → `handleJsonRpcRequest` → stdout 写一行 JSON |

---

## 3. 前端架构与模块职责

### 3.1 入口与路由

**[main.tsx](file:///workspace/frontend/src/main.tsx)** — 入口
`ReactDOM.createRoot` 渲染 `ConfigProvider`(zhCN, colorPrimary:#1677ff) + `AntdApp` + `MessageBridge`（重定向静态 message 到 dynamic instance）+ `ErrorBoundary` + `AuthProvider` + `Root`。最早初始化 Sentry。

**[Root.tsx](file:///workspace/frontend/src/Root.tsx)** — 路由根
- 首屏关键页面（Login/Workbench/WorkItems/WorkItemDetail/Dashboard）直接 import
- 其他 30+ 页面用 `React.lazy` 懒加载 + Suspense fallback（Vite 自动 code split）
- `ProtectedRoute` 未登录跳转 `/login`
- `ThemedApp` 应用 antd dark/light algorithm
- 包裹 `AgentPanelProvider`（全局 Agent 面板状态）

**核心路由表**：

| 路径 | 页面 |
|---|---|
| `/login` | LoginPage（无需鉴权） |
| `/` → `/workbench` | WorkbenchPage |
| `/dashboard` | DashboardPage |
| `/work-items/:type` / `/:type/:id` | WorkItemsPage / WorkItemDetailPage |
| `/flows` / `/flows/:id` | FlowsPage / FlowEditorPage |
| `/reviews` / `/reviews/:id` | ReviewsPage / ReviewDetailPage |
| `/dashboards` / `/dashboards/:id` | DashboardsPage / DashboardDetailPage |
| `/charts/new` / `/charts/:id` | ChartEditorPage |
| `/ai` | AIPage |
| `/gantt` / `/tree` / `/resources` | GanttPage / TreeViewPage / ResourcesPage |
| `/projects` / `/customers` / `/car-models` / `/dependencies` | 业务实体页 |
| `/automation` / `/fields` / `/baselines` / `/analysis` | 配置与分析页 |
| `/tests` / `/reports` / `/imports` | 测试/报告/导入页 |
| `/users` / `/audit-logs` / `/tenants` / `/llm-settings` / `/mcp` / `/agent-stats` | 系统管理页 |
| `/notifications` / `/watching` | 通知与关注页 |
| `*` | NotFoundPage |

### 3.2 主布局 App.tsx

**[App.tsx](file:///workspace/frontend/src/App.tsx)** — 主布局（antd Layout 三段式）

- **左侧 Sider**（width 232，可折叠）：Logo + AI 助理按钮（Ctrl+K 唤起）+ 6 个分组导航菜单（工作区/工作项/度量与报告/流程配置/空间与数据/系统管理）+ 底部"当前迭代"列表
- **顶部 Header**：页面标题 + 空间切换 + 全局统计（P0/P1 计数）+ 收藏下拉 + 通知下拉（Badge + WS 推送预览）+ WS 状态 + 主题切换 + 用户菜单
- **中间 Content**：`<Outlet />` 路由出口 + 右侧嵌入 `<AgentPane />`
- **全局挂载**：`GlobalAIAssistant`(Drawer) + `InlineAskButton`(划词问 AI) + 键盘快捷键 Modal（g+字母导航、Ctrl+U 唤起 Agent、Ctrl+K 唤起 AI 助理）
- 监听 WS `notification` 事件，收到时增加未读数 + 插入预览面板 + 顶部 toast

**[AuthContext.tsx](file:///workspace/frontend/src/AuthContext.tsx)** — 认证上下文
提供 `AuthUser`(id/username/displayName/role/department/tenantId)、`token`、`login(username, password)`、`logout()`；localStorage 持久化（key: `avm-auth`），启动时自动恢复登录态。

**[ThemeContext.tsx](file:///workspace/frontend/src/ThemeContext.tsx)** — 主题上下文
提供 `mode: 'light' | 'dark'`、`toggle`；localStorage 持久化（key: `avm-theme-mode`）；首次访问跟随系统 `prefers-color-scheme`；同步到 `<html data-theme>` + antd ConfigProvider。

### 3.3 API 客户端

**[api.ts](file:///workspace/frontend/src/api.ts)** — API 客户端（按域分组）

- `api`：axios 实例，baseURL `/api`，timeout 15s
- `llmApi`：独立长超时实例（60s），用于 LLM 工具链避免普通接口被拖累
- `attachAuthInterceptor`：请求拦截器自动注入 `Authorization: Bearer xxx`（从 localStorage 读 token）；响应拦截器 401 自动清 token 跳 `/login?expired=1`

**按域分组的 API 模块**：

| API 模块 | 覆盖范围 |
|---|---|
| `workItemApi` | 工作项 CRUD + 批量 + 关联 + 甘特 + 估分历史 + 负荷 |
| `iterationApi` / `commentApi` / `activityApi` / `metaApi` | 迭代/评论/活动/元数据 |
| `watchApi` / `savedFilterApi` / `mentionApi` | 关注/共享筛选/@提及 |
| `flowApi` / `reviewApi` | 流程/评审 |
| `chartApi` / `dashboardApi` | 图表/仪表盘 |
| `aiApi` | AI 能力（估分/归类/优先级/风险/问答/拆解/周报/月报/NL搜索/重复Bug检测/一键归类等），LLM 调用走 llmApi |
| `userApi` / `spaceApi` / `notificationApi` / `favoriteApi` | 用户/空间/通知/收藏 |
| `resourceApi` / `searchApi` / `workbenchApi` | 资源/搜索/工作台 |
| `fieldApi` / `templateApi` / `treeApi` | 字段/模板/树形 |
| `automationApi` / `webhookApi` / `importApi` / `handoverApi` | 自动化/Webhook/导入/移交 |
| `resourceAnalysisApi` / `baselineApi` | 资源分析/基线 |
| `mcpApi` / `testApi` / `ssoApi` / `llmSettingsApi` | MCP/测试/SSO/LLM 设置 |
| `customerApi` / `carModelApi` / `contactApi` / `projectApi` / `dependencyApi` | 业务实体 |
| `agentsApi` / `agentSessionsApi` / `agentFeedbackApi` | V1.55 Agent 配置/会话/反馈 |
| `uploadApi` / `auditApi` | 上传/审计 |
| `exportWorkItems` 等 | 数据导出（responseType: blob） |

### 3.4 页面（Pages）

**目录**：[frontend/src/pages/](file:///workspace/frontend/src/pages/)

| 页面 | 职责 |
|---|---|
| [WorkbenchPage](file:///workspace/frontend/src/pages/WorkbenchPage.tsx) | 个人工作台首页：核心指标 + 我负责的 + 临期提醒 + 本周负荷 + 待评审 + 最近通知，订阅 work_item_changed 自动刷新 |
| [WorkItemsPage](file:///workspace/frontend/src/pages/WorkItemsPage.tsx) | 工作项列表页（按 type 路由参数区分需求/任务/缺陷/版本）：支持 table/kanban/gantt/sortable 四种视图切换，筛选/视图/搜索状态同步 URL，集成 useSavedFilters + useOperationUndo + DuplicateBugAlert |
| [WorkItemDetailPage](file:///workspace/frontend/src/pages/WorkItemDetailPage.tsx) | 工作项详情页：字段编辑、评论（@mention + 拖拽粘贴图片）、活动 Timeline、WorkloadTrend、DependencyGraph、AI 拆解、CommentSummaryCard、关注/订阅 |
| [DashboardPage](file:///workspace/frontend/src/pages/DashboardPage.tsx) | 项目仪表盘：stats + iterations + 最近/逾期工作项 + WorkloadByUser + RiskAlertPanel + AI 周报月报生成 |
| [FlowsPage](file:///workspace/frontend/src/pages/FlowsPage.tsx) / [FlowEditorPage](file:///workspace/frontend/src/pages/FlowEditorPage.tsx) | 流程列表 / 基于 @xyflow/react 的可视化流程编辑器（拖拽编排 FlowNode 与 FlowTransition） |
| [ReviewsPage](file:///workspace/frontend/src/pages/ReviewsPage.tsx) / [ReviewDetailPage](file:///workspace/frontend/src/pages/ReviewDetailPage.tsx) | 评审列表 / 评审详情 + 参与者提交要素 |
| [DashboardsPage](file:///workspace/frontend/src/pages/DashboardsPage.tsx) / [DashboardDetailPage](file:///workspace/frontend/src/pages/DashboardDetailPage.tsx) | 仪表盘列表 / 仪表盘详情（组件拖拽布局） |
| [ChartEditorPage](file:///workspace/frontend/src/pages/ChartEditorPage.tsx) | 图表编辑器：可视化配置维度/指标/筛选/分组 + 实时数据预览 |
| [AIPage](file:///workspace/frontend/src/pages/AIPage.tsx) | AI 智能助理页：聊天 + AI 字段配置 + 模型状态 |
| [LLMSettingsPage](file:///workspace/frontend/src/pages/LLMSettingsPage.tsx) | LLM 大模型设置：provider 卡片网格 + 配置 Modal（ModelsEditor + 测试连接/聊天） |
| [MCPPage](file:///workspace/frontend/src/pages/MCPPage.tsx) | MCP Server 测试页：展示工具/资源/prompts + 调用测试 + NL 问答测试 |
| [AgentStatsPage](file:///workspace/frontend/src/pages/AgentStatsPage.tsx) | V1.55.6 Agent 使用统计 |
| [ProjectPage](file:///workspace/frontend/src/pages/ProjectPage.tsx) / [CustomerPage](file:///workspace/frontend/src/pages/CustomerPage.tsx) / [CarModelPage](file:///workspace/frontend/src/pages/CarModelPage.tsx) / [DependenciesPage](file:///workspace/frontend/src/pages/DependenciesPage.tsx) | 业务实体管理页 |
| [UsersPage](file:///workspace/frontend/src/pages/UsersPage.tsx) / [TenantPage](file:///workspace/frontend/src/pages/TenantPage.tsx) / [AuditLogsPage](file:///workspace/frontend/src/pages/AuditLogsPage.tsx) | 用户/租户/审计日志管理 |
| [AutomationPage](file:///workspace/frontend/src/pages/AutomationPage.tsx) / [FieldsPage](file:///workspace/frontend/src/pages/FieldsPage.tsx) / [BaselinePage](file:///workspace/frontend/src/pages/BaselinePage.tsx) / [AnalysisPage](file:///workspace/frontend/src/pages/AnalysisPage.tsx) | 自动化/字段/基线/分析配置 |
| [TestPage](file:///workspace/frontend/src/pages/TestPage.tsx) | 测试管理 |
| [ReportsPage](file:///workspace/frontend/src/pages/ReportsPage.tsx) | AI 周报/月报历史 |
| [ImportWizardPage](file:///workspace/frontend/src/pages/ImportWizardPage.tsx) | 数据导入向导 |
| [GanttPage](file:///workspace/frontend/src/pages/GanttPage.tsx) / [TreeViewPage](file:///workspace/frontend/src/pages/TreeViewPage.tsx) | 甘特图 / 树形视图 |
| [ResourcesPage](file:///workspace/frontend/src/pages/ResourcesPage.tsx) | 人员排期与负荷 |
| [NotificationsPage](file:///workspace/frontend/src/pages/NotificationsPage.tsx) / [WatchingPage](file:///workspace/frontend/src/pages/WatchingPage.tsx) | 通知 / 我关注的 |
| [LoginPage](file:///workspace/frontend/src/pages/LoginPage.tsx) | 登录页 |
| [NotFoundPage](file:///workspace/frontend/src/pages/NotFoundPage.tsx) | 404 兜底 |

### 3.5 视图（Views）

**目录**：[frontend/src/views/](file:///workspace/frontend/src/views/)

| 视图 | 职责 |
|---|---|
| [TableView](file:///workspace/frontend/src/views/TableView.tsx) | 工作项表格视图：多选/批量操作/行内状态变更/删除/刷新 + j-k 浏览 + e 跳转快捷键 |
| [KanbanView](file:///workspace/frontend/src/views/KanbanView.tsx) | 工作项看板视图：基于 @dnd-kit/core 拖拽改状态，含 KPI 概览卡片 |
| [GanttView](file:///workspace/frontend/src/views/GanttView.tsx) | 工作项甘特图：day/week/month 单位切换 + 偏移导航 + 基线对比 |
| [SortableListView](file:///workspace/frontend/src/views/SortableListView.tsx) | 可拖拽排序的工作项列表：基于 @dnd-kit/sortable，顺序保存 localStorage，支持键盘拖拽 |

### 3.6 通用组件（Components）

**目录**：[frontend/src/components/](file:///workspace/frontend/src/components/)

| 组件 | 职责 |
|---|---|
| [GlobalAIAssistant](file:///workspace/frontend/src/components/GlobalAIAssistant.tsx) | 跨页面 AI 助理 Drawer：Ctrl+K 触发，多轮对话（sessionStorage 持久化），多模态输入（图片/文档/语音/拖拽粘贴），`/` 命令菜单，模型选择（跨厂商切换），深度思考开关，AbortController 停止生成，toolCalls 显示 |
| [AgentPane](file:///workspace/frontend/src/components/AgentPane.tsx) | 嵌入式 Agent 聊天容器：顶部栏 + Agent 切换 chip 行（6 个 Agent）+ 消息区（Markdown + 工具调用折叠 + MessageFeedbackBar）+ 输入区（ModelSelector + Enter 发送）+ 4px 拖拽条调宽度（280-720px）+ Detached 浮窗模式 |
| [AgentPanelContext](file:///workspace/frontend/src/components/AgentPanelContext.tsx) | Agent 面板 UI 状态上下文：activeAgentKey/panelOpen/sessionId/detached/inline，持久化 localStorage + URL 参数 `?agentSession=xxx` |
| [EChart](file:///workspace/frontend/src/components/EChart.tsx) | 通用 ECharts 包装：按需引入 7 种图表 + 6 个组件，支持暗色主题，resize 自动重绘；附带 `buildEChartsOption` 工具函数 |
| [PageHeaderBar](file:///workspace/frontend/src/components/PageHeaderBar.tsx) | 通用页面头：标题 + 操作按钮 + 空间切换 |
| [FilterBar](file:///workspace/frontend/src/components/FilterBar.tsx) | 通用筛选栏 |
| [StatsBar](file:///workspace/frontend/src/components/StatsBar.tsx) | 统计指标条 |
| [StateViews](file:///workspace/frontend/src/components/StateViews.tsx) | 状态视图（空/加载/错误） |
| [CrudDrawer](file:///workspace/frontend/src/components/CrudDrawer.tsx) | 通用 CRUD 抽屉（含 useFormUndoRedo） |
| [tableActionColumn](file:///workspace/frontend/src/components/tableActionColumn.tsx) | 表格操作列生成器 |
| [SavedFilterButton](file:///workspace/frontend/src/components/SavedFilterButton.tsx) | 保存筛选按钮 |
| [BurndownChart](file:///workspace/frontend/src/components/BurndownChart.tsx) | 燃尽图 |
| [WorkloadByUser](file:///workspace/frontend/src/components/WorkloadByUser.tsx) / [WorkloadTrend](file:///workspace/frontend/src/components/WorkloadTrend.tsx) | 负荷按人 / 负荷趋势 |
| [DependencyGraph](file:///workspace/frontend/src/components/DependencyGraph.tsx) | 依赖关系图 |
| [RiskAlertPanel](file:///workspace/frontend/src/components/RiskAlertPanel.tsx) | 风险预警面板 |
| [DuplicateBugAlert](file:///workspace/frontend/src/components/DuplicateBugAlert.tsx) | 重复缺陷预警 |
| [CommentSummaryCard](file:///workspace/frontend/src/components/CommentSummaryCard.tsx) | AI 评论摘要卡片 |
| [MarkdownContent](file:///workspace/frontend/src/components/MarkdownContent.tsx) | Markdown 渲染（dompurify 消毒） |
| [MessageFeedbackBar](file:///workspace/frontend/src/components/MessageFeedbackBar.tsx) | 消息点赞/点踩 |
| [ModelSelector](file:///workspace/frontend/src/components/ModelSelector.tsx) | LLM 模型选择器 |
| [SessionMenu](file:///workspace/frontend/src/components/SessionMenu.tsx) | Agent 会话菜单 |
| [SlashCommandMenu](file:///workspace/frontend/src/components/SlashCommandMenu.tsx) | `/` 命令菜单 |
| [InlineAskButton](file:///workspace/frontend/src/components/InlineAskButton.tsx) | 划词问 AI |
| [AdminOnly](file:///workspace/frontend/src/components/AdminOnly.tsx) | 管理员可见包装 |
| [AppBreadcrumb](file:///workspace/frontend/src/components/AppBreadcrumb.tsx) | 面包屑 |
| [ErrorBoundary](file:///workspace/frontend/src/components/ErrorBoundary.tsx) | 错误边界 |

### 3.7 Hooks

**目录**：[frontend/src/hooks/](file:///workspace/frontend/src/hooks/)

| Hook | 职责 |
|---|---|
| [useCrudResource](file:///workspace/frontend/src/hooks/useCrudResource.ts) | 封装 CRUD 列表页四件套（load/create/edit/delete + Drawer 开合 + form 实例 + 错误吞咽） |
| [useAgentChat](file:///workspace/frontend/src/hooks/useAgentChat.ts) | Agent 聊天 hook：维护 messages、调 `/api/ai-command` 注入 systemPrompt + allowedTools、abort 控制、自动持久化到 AgentSession |
| [useAiFormFiller](file:///workspace/frontend/src/hooks/useAiFormFiller.ts) | 封装 `validateFields → aiApi.aiFillForm → form.setFieldsValue` 流程 |
| [useAsync](file:///workspace/frontend/src/hooks/useAsync.ts) | 通用异步状态 hook（loading/data/error + reload，支持自动重试） |
| [useDebouncedValue](file:///workspace/frontend/src/hooks/useDebouncedValue.ts) | 搜索防抖（默认 300ms） |
| [useDragPasteUpload](file:///workspace/frontend/src/hooks/useDragPasteUpload.ts) | 通用拖拽 + 粘贴上传（image-only / all 两种模式） |
| [useExport](file:///workspace/frontend/src/hooks/useExport.ts) | xlsx/csv 导出（loading 状态 + 文件名解析 + blob 下载） |
| [useFormUndoRedo](file:///workspace/frontend/src/hooks/useFormUndoRedo.ts) | 表单编辑撤销/重做（追踪 onValuesChange，最多 50 步） |
| [useOperationUndo](file:///workspace/frontend/src/hooks/useOperationUndo.ts) | 操作撤销/重做（操作栈，用于看板拖拽等异步操作，最多 30 步） |
| [useResizablePanel](file:///workspace/frontend/src/hooks/useResizablePanel.ts) | 可调宽度面板（持久化 localStorage，限制 [min, max]） |
| [useSavedFilters](file:///workspace/frontend/src/hooks/useSavedFilters.ts) | 保存筛选条件（localStorage + 可选云端同步，云端失败降级本地） |
| [useUndoRedo](file:///workspace/frontend/src/hooks/useUndoRedo.ts) | 基础撤销/重做（命令式 + `useUndoableState` 替代 useState，状态快照栈默认 50 步） |
| [useUrlState](file:///workspace/frontend/src/hooks/useUrlState.ts) | 筛选/分页/Tab 状态同步到 URL search params（replace 模式不污染历史，支持类型转换） |

### 3.8 前端服务（services）

**目录**：[frontend/src/services/](file:///workspace/frontend/src/services/)

| 文件 | 职责 |
|---|---|
| [ws.ts](file:///workspace/frontend/src/services/ws.ts) | 单例 `WsClient`（`wsClient`）：`connect(token)` 建立 `/api/ws?token=xxx` 连接，断线后按指数退避（1s/2s/4s/8s/max 30s）自动重连，提供 `subscribe(eventName, handler)` / `onStatusChange(cb)` / `disconnect()`；事件类型：connected/disconnected/notification/pong；端口可配置（`VITE_WS_PORT` 开发 4001，生产走同源 nginx） |
| [useWorkItemChanged.ts](file:///workspace/frontend/src/services/useWorkItemChanged.ts) | 订阅 `work_item_changed` WS 事件的 React hook，可按 key/id 过滤，AI 修改工作项后自动刷新相关页面 |

---

## 4. 数据模型

**文件**：[backend/prisma/schema.prisma](file:///workspace/backend/prisma/schema.prisma)

数据库共 40+ 个模型，按业务域分组：

### 4.1 工作项核心

| 模型 | 说明 | 关键字段 |
|---|---|---|
| `WorkItem` | 工作项（核心实体） | type(requirement/task/bug/release)、key(唯一)、title、status、priority(P0-P3)、severity、estimate、actualHours、planStart/End、assignee、reporter、parentId、currentNodeId、projectId/carModelId/customerId、deletedAt(软删除) |
| `WorkItemRelation` | 工作项关联（双向） | fromId、toId、relationType(关联/阻塞/重复/引用) |
| `WorkItemWatcher` | 工作项关注 | workItemId、userId（唯一约束） |
| `Iteration` | 迭代 | name、goal、status、startDate/endDate |
| `Comment` | 评论 | workItemId、author、content、imageUrl、reactions(JSON) |
| `Activity` | 活动流 | workItemId、actor、action、field、oldValue、newValue |
| `SavedFilter` | 团队共享筛选 | resourceKey、name、filters(JSON)、shared、ownerId |

### 4.2 流程与评审

| 模型 | 说明 |
|---|---|
| `NodeFlow` | 节点流（按 workType 唯一活跃） |
| `FlowNode` | 流程节点（含 statusValue、roles、requiredFields、entryRule、exitRule、slaHours、dodItems、reviewType） |
| `FlowTransition` | 流转（fromNode → toNode + condition） |
| `Review` | 评审（reviewType=TR/DCP/QR、status、conclusion） |
| `ReviewItem` | 评审要素（score/checked/answer） |
| `ReviewParticipant` | 评审参与者（role、weight、hasResponded） |
| `ReviewTemplate` | 评审模板 |

### 4.3 度量与可视化

| 模型 | 说明 |
|---|---|
| `ChartConfig` | 图表配置（chartType、dimensions、measures、filters、source） |
| `Dashboard` | 仪表盘（layout + charts） |

### 4.4 AI 相关

| 模型 | 说明 |
|---|---|
| `AIFieldConfig` | AI 字段配置（workType + targetField + capability + prompt） |
| `AIRunLog` | AI 运行日志 |
| `LLMSettings` | LLM Provider 设置（provider 唯一、apiKey、model、isPrimary） |
| `Agent` | V1.55 AI 专用 Agent（key 唯一、systemPrompt、scope、allowedPages、allowedTools） |
| `AgentSession` | Agent 会话（messages JSON、metadata） |
| `AgentMessageFeedback` | Agent 消息反馈（up/down） |
| `AIReport` | AI 周报/月报历史 |

### 4.5 用户与权限

| 模型 | 说明 |
|---|---|
| `User` | 用户（username 唯一、password、role、token 唯一、tokenExpiresAt、tenantId、feishuOpenId 等 SSO 字段） |
| `Space` | 空间（多空间隔离） |
| `SpaceMember` | 空间成员 |
| `Tenant` | 租户（企业版） |
| `SSOSetting` / `SSOLog` | SSO 配置与日志 |

### 4.6 业务实体（吉利 AVM 集成项目）

| 模型 | 说明 |
|---|---|
| `Customer` | 客户（吉利各车型项目组） |
| `CarModel` | 车型（吉利全系） |
| `Contact` | 联系人（UPL/PPM/测试/开发/AVM 接口人） |
| `Project` | AVM 集成项目（绑定 1 客户 + 1 车型，含合同类型/金额/预算/工时/风险/进度） |
| `ExternalDependency` | 外部依赖（台架/实车/车模/SDB/UE/UI/标定） |

### 4.7 协作与自动化

| 模型 | 说明 |
|---|---|
| `Notification` | 通知（recipientId、type、level、read） |
| `Favorite` | 收藏（按 folder 分组） |
| `ResourceAllocation` | 人员排期 |
| `WorkbenchConfig` | 工作台配置 |
| `FormulaField` / `RollupField` | 公式字段 / 聚合字段 |
| `WorkItemTemplate` | 工作项模板 |
| `AutomationRule` / `AutomationLog` | 自动化规则与日志 |
| `WebhookConfig` / `WebhookLog` | Webhook 配置与日志 |
| `ImportJob` | 导入任务 |
| `WorkHandover` | 工作移交 |
| `Baseline` | 基线快照 |
| `ResourceAnalysis` | 资源分析历史 |
| `AuditLog` | 全系统审计日志 |

### 4.8 测试管理

| 模型 | 说明 |
|---|---|
| `TestCase` | 测试用例 |
| `TestPlan` / `TestPlanCase` | 测试计划 + 计划-用例关联 |
| `TestRun` | 测试执行 |
| `TestCaseBug` | 用例-缺陷关联 |

---

## 5. 关键流程与依赖关系

### 5.1 后端服务依赖关系

```
aiEngine ─┬─→ llmProvider
          ├─→ projectSnapshot
          └─→ wikiKnowledge

aiTools ─┬─→ aiToolsExt
         ├─→ aiToolsQuery (→ aiTools/)
         └─→ wsServer

mcpCore ──→ aiTools（桥接 124 个工具）

riskScanner ─┬─→ aiTools
             ├─→ llmProvider
             ├─→ projectSnapshot
             └─→ wsServer

agentCommands ─┬─→ llmProvider
               ├─→ projectSnapshot
               ├─→ wikiKnowledge
               └─→ aiTools

flowEngine / reviewEngine / formulaEngine / rollupEngine ──→ db (prisma)

automationEngine ──→ webhookEngine ──→ (HTTP 发送)
                                 └─→ wsServer

alertEngine ──→ (独立通道，持久化到 WebhookLog)
```

### 5.2 工作项状态流转

工作项状态机由 `constants.ts` 的 `STATUS_BY_TYPE` 定义，流转由 `flowEngine.transitionWorkItem` 校验：

- **requirement**：待评审 → 已规划 → 开发中 → 测试中 → 验收中 → 已验收 → 已关闭
- **task**：待领取 → 进行中 → 自测中 → 已完成
- **bug**：待修复 → 修复中 → 待验证 → 已关闭/已驳回
- **release**：规划中 → 集成中 → 发布中 → 已发布

### 5.3 评审与流程联动

1. 工作项流转到含 `reviewType` 的节点时，`flowEngine` 自动发起评审
2. 参与者通过 `reviewEngine.submitReviewItems` 提交要素
3. 全员提交完毕后状态自动更新
4. `reviewEngine.finalizeReview` 计算总结论（go/not_go/go_with_risk）并回写工作项
5. 评审结论触发 `automationEngine` 规则 + `webhookEngine` 推送

### 5.4 AI 调用链

**前端 → 后端 AI 调用路径**：

```
前端 aiApi.xxx (llmApi, 60s 超时)
  → /api/ai-command/command (aiCommand.ts 路由)
    → 加载 wikiKnowledge + projectSnapshot 构建 system context
    → llmProvider.chat() (function calling)
      → aiTools.executeTool() 调用具体工具操作数据
        → wsServer.pushToUser() 推送 work_item_changed 事件
      → 前端 useWorkItemChanged 收到事件自动刷新
```

### 5.5 实时通知链

```
业务事件（状态变更/评论/提及/AI 修改）
  → notifyWatchers / mentions.notifyMentions
    → 写 Notification 表
    → wsServer.pushToUser(userId, payload)
      → 前端 wsClient.subscribe('notification', handler)
        → 顶部 Header Badge 增加 + 预览面板插入 + toast
    → webhookEngine.triggerWebhooks (推送到飞书/钉钉/企微)
```

### 5.6 前端模块依赖

```
main.tsx
  └─ Root.tsx (路由 + 主题 + AgentPanelProvider)
       ├─ AuthContext (认证)
       ├─ ThemeContext (主题)
       ├─ App.tsx (主布局)
       │    ├─ api.ts (HTTP 客户端，拦截器注入 token)
       │    ├─ ws.ts (WebSocket 客户端)
       │    ├─ GlobalAIAssistant (Drawer)
       │    ├─ AgentPane (嵌入面板)
       │    └─ <Outlet /> → 各页面
       │         ├─ useCrudResource / useAsync (数据加载)
       │         ├─ views/ (4 种工作项视图)
       │         ├─ EChart (图表)
       │         └─ useWorkItemChanged (WS 自动刷新)
       └─ AgentPanelContext (Agent 面板状态)
```

---

## 6. 项目运行方式

### 6.1 环境要求

- Node.js 18+（已测试 v25.2.1）
- npm 9+
- Windows / macOS / Linux

### 6.2 本地开发启动

```bash
# 1. 安装后端依赖 + 初始化数据库
cd backend
npm install
npm run db:push     # 推送 Prisma schema 到 SQLite
npm run db:seed     # 写入演示数据

# 2. 安装前端依赖
cd ../frontend
npm install

# 3. 启动后端（监听 http://localhost:4000）
cd ../backend
npm run dev

# 4. 启动前端（监听 http://localhost:5173，Vite Proxy 转发 /api 到 4000）
cd ../frontend
npm run dev
```

打开浏览器访问 **http://localhost:5173**。

**测试账号**：

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `admin123` | 租户管理员（tenant_admin） |
| `pm` | `pm123` | 空间管理员（space_admin） |
| `zhangsan` | `123456` | 业务管理员 |
| `lisi` | `123456` | 普通成员 |

> 注：dev 模式无 token 视为 `dev-user / tenant_admin`，可直接访问所有接口。

### 6.3 常用 npm 脚本

**后端**（[backend/package.json](file:///workspace/backend/package.json)）：

| 脚本 | 说明 |
|---|---|
| `npm run dev` | tsx watch 热重载开发 |
| `npm run build` | tsc 编译到 dist/ |
| `npm start` | 运行编译产物 |
| `npm run db:push` | 推送 schema 到 SQLite |
| `npm run db:seed` | 写入种子数据 |
| `npm run db:reset` | 重建数据库 + 重新 seed |
| `npm run db:push:pg` | 切换到 PostgreSQL schema 并推送 |
| `npm run db:reset:sqlite` | 回退到 SQLite 并重置 |
| `npm run backup` / `npm run db:restore` | 备份 / 恢复 |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Vitest 单元测试 |
| `npm run lint` / `npm run format` | ESLint + Prettier |
| `npm run gen:swagger` | 生成 Swagger OpenAPI spec |

**前端**（[frontend/package.json](file:///workspace/frontend/package.json)）：

| 脚本 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | tsc --noEmit + vite build |
| `npm run preview` | 预览构建产物 |
| `npm test` / `npm run test:coverage` | Vitest 单元测试 |
| `npm run e2e` / `npm run e2e:ui` | Playwright E2E 测试 |
| `npm run lint` / `npm run format` | 检查缺失 import / Prettier |

### 6.4 生产部署（Docker Compose）

**前置**：复制 `.env.example` 为 `.env`，修改 `POSTGRES_PASSWORD` / `CORS_ORIGIN` / `API_KEY_ENCRYPTION_KEY`（生成：`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`）。

```bash
cp .env.example .env
# 编辑 .env 修改必要配置
docker compose up -d --build
# 导入演示数据
docker compose exec backend npx tsx src/seed.ts
```

访问 **http://localhost:8080**（前端 Nginx 反代 `/api` 到 backend）。

**docker-compose 服务**（[docker-compose.yml](file:///workspace/docker-compose.yml)）：

| 服务 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 内部 | 主数据库，healthcheck `pg_isready` |
| `backend` | 多阶段构建 node:20-alpine | 4000/4001（内部） | 启动前自动 `prisma migrate deploy`，使用 tini 处理 PID 1 信号 |
| `frontend` | build → nginx:1.27-alpine | 8080:80 | 静态托管 + SPA fallback + `/api` 反代 |
| `backup` | postgres:16-alpine | — | 每天 03:00 UTC 自动 `pg_dump`，保留 7 天 |

**后端 Dockerfile**（[backend/Dockerfile](file:///workspace/backend/Dockerfile)）三阶段：
1. `deps`：安装生产依赖（强制使用 PostgreSQL schema）
2. `builder`：安装全部依赖 + `prisma generate` + `tsc`
3. `runtime`：node:20-alpine + postgresql-client + tini，拷贝 dist + node_modules + prisma，CMD 自动 `prisma migrate deploy && node dist/index.js`

**前端 Dockerfile**（[frontend/Dockerfile](file:///workspace/frontend/Dockerfile)）两阶段：
1. `builder`：`npm run build`（VITE_API_BASE=/api 运行时注入）
2. `runtime`：nginx:1.27-alpine 静态托管

**前端 Nginx 配置**（[frontend/nginx.conf](file:///workspace/frontend/nginx.conf)）：
- gzip 压缩 + 安全头（X-Frame-Options/X-Content-Type-Options/Referrer-Policy）
- `/api/ws` 反代到 backend:4001（WebSocket upgrade，86400s 超时）
- `/api/mcp/(stream|sse|messages)` 单独处理（关闭 buffering，SSE 长连接）
- `/api/` 反代到 backend:4000（关闭 buffering，300s 超时）
- `/` SPA fallback `try_files $uri $uri/ /index.html`
- 静态资源缓存 1 年（immutable）

### 6.5 数据库切换

开发用 SQLite（[prisma/schema.prisma](file:///workspace/backend/prisma/schema.prisma)），生产用 PostgreSQL（[prisma/schema.production.prisma](file:///workspace/backend/prisma/schema.production.prisma)，含 `@db.Text` 等 PG 专属类型）。

- 切到 PG：`npm run db:push:pg`（自动复制 production schema）
- 回退 SQLite：`npm run db:reset:sqlite`（git checkout schema + reset + seed）
- Docker 构建时强制使用 PG schema

### 6.6 MCP Server 接入

详见 [MCP_SETUP.md](file:///workspace/MCP_SETUP.md)。AVM 后端暴露 3 种传输方式：

**方式 A：HTTP 模式（推荐，SSE 协议）**

```json
{
  "mcpServers": {
    "avm": {
      "url": "http://localhost:4000/api/mcp/stream",
      "type": "http"
    }
  }
}
```

**方式 B：stdio 模式**

```json
{
  "mcpServers": {
    "avm": {
      "command": "npx",
      "args": ["tsx", "/path/to/backend/src/bin/mcp-stdio.ts"]
    }
  }
}
```

能力：124 个 Tools + 50+ Resources（每个工作项一个 `avm://work-item/{id}`）+ 4 个 Prompts（每日站会/迭代回顾/风险评估/新人入职）。

### 6.7 监控栈（可选）

**目录**：[monitoring/](file:///workspace/monitoring/)

```bash
docker compose up -d                                          # 先起主服务
docker compose -f monitoring/docker-compose.monitoring.yml up -d  # 再起监控栈
```

| 服务 | 端口 | 说明 |
|---|---|---|
| Prometheus | 9090 | 抓取 backend `/metrics`（30 天保留） |
| Loki | 3100 | 日志聚合 |
| Promtail | — | 采集 Docker 容器日志 |
| Grafana | 3000 | 仪表盘（admin/admin），数据源预配置 Prometheus + Loki |

### 6.8 性能测试

**目录**：[perf/](file:///workspace/perf/)

- `k6-login.js` / `k6-workitems.js` / `k6-ai-command.js`：k6 压测脚本
- `autocannon-runner.mjs`：autocannon 压测
- `baseline-report.json` / `baseline-raw.txt`：基线报告

---

## 7. 可观测性与运维

### 7.1 日志

- **winston 结构化日志**（[utils/logger.ts](file:///workspace/backend/src/utils/logger.ts)）：dev 彩色人类可读，生产 JSON 行；输出 stdout（容器友好）+ 生产额外写 `error.log`/`combined.log`（10MB 轮转，保留 7 份）
- **子 logger**：`authLogger` / `dbLogger` / `apiLogger` / `aiLogger`
- **访问日志**：morgan 写 winston（dev 彩色 / 生产标准格式）

### 7.2 指标

- **Prometheus 指标**（[utils/metrics.ts](file:///workspace/backend/src/utils/metrics.ts)）：自实现 exposition format（不引入 prom-client）
  - HTTP 请求计数/耗时直方图
  - Node 进程内存/CPU/uptime
  - 慢查询/DB 错误计数
  - 路由高基数归一化（UUID/数字 ID → `:uuid`/`:id`）
- **端点**：`/metrics`（不走鉴权，建议 nginx 层限制内网访问）

### 7.3 错误追踪

- **Sentry**（[utils/sentry.ts](file:///workspace/backend/src/utils/sentry.ts)）：仅配置 `SENTRY_DSN` 时启用
  - PII 递归脱敏（26 个敏感 key → `[REDACTED]`）
  - 性能采样 5%
  - `setupSentryExpressHandlers` 注册 v10 错误 handler
  - 全局错误处理中间件 5xx 自动 `captureException`

### 7.4 审计日志

- **全系统审计**（[utils/audit.ts](file:///workspace/backend/src/utils/audit.ts)）：覆盖 27 种实体 + 15 种动作
  - `recordAudit` fire-and-forget 写库
  - `diffFields` 字段级 diff
  - `audit(entity, action)` 中间件 + `flush(req, extra)`
  - 查询接口 `space_admin` 及以上可读

### 7.5 健康检查

- **端点**：`/api/health`（基础）+ `/api/health/deep`（探测 DB 连通性，供 K8s liveness/readiness 用）

### 7.6 系统告警

- **告警引擎**（[services/alertEngine.ts](file:///workspace/backend/src/services/alertEngine.ts)）：5 分钟去重 + 多通道 + 持久化
  - `alertOnServerError`：5xx 错误率告警
  - `alertOnHealthFail`：健康检查失败告警
  - `alertOnEngineError`：AI/Webhook/Automation 引擎异常告警

### 7.7 优雅关闭

- `SIGTERM` / `SIGINT` 信号 → `prisma.$disconnect()` → `process.exit(0)`
- `uncaughtException` → 上报 Sentry + 告警 → 延迟 1s 退出（给 Sentry 时间发送）
- `unhandledRejection` → 上报 Sentry（不退出）

### 7.8 数据备份

- **Docker backup 服务**：每天 03:00 UTC 自动 `pg_dump`，保留 `BACKUP_KEEP_DAYS`（默认 7）天
- **脚本**：[backend/scripts/backup.ts](file:///workspace/backend/scripts/backup.ts) / [restore.ts](file:///workspace/backend/scripts/restore.ts) / [backup-restore-test.ts](file:///workspace/backend/scripts/backup-restore-test.ts)

---

> 本 Code Wiki 基于代码库当前状态生成，涵盖项目整体架构、模块职责、关键类与函数、依赖关系及运行方式。如需更细节的 API 文档，启动后端后访问 `http://localhost:4000/api-docs`（Swagger UI）。
