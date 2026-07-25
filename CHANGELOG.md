# Changelog

AVM 项目中心的所有版本变更记录。本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [V1.52] - 2026-07-25

### 通知闭环与团队协作

- **关注通知闭环** — `notifyStatusChange` + `notifyNewComment`，工作项状态变更/新评论时通知关注者，通过 DB + WebSocket + Webhook 多渠道推送
- **团队共享筛选** — 新增 `SavedFilter` 数据模型 + API，`useSavedFilters` Hook 升级双写（localStorage 离线 + 云端持久化），支持团队共享
- **通用筛选按钮组件** — `SavedFilterButton` 抽取复用，8 个 CRUD 页接入（Project/Users/Tenant/Flows/Reviews/Dashboards/Fields/WorkItems）
- **通知渲染** — NotificationsPage + App.tsx 新增 `watch_status_change` / `watch_comment_added` 类型渲染

### 修复

- 替换废弃的 `destroyTooltipOnHide` 为 `destroyOnHidden`（antd v5 兼容）

## [V1.51] - 2026-07-25

### 协作与沟通增强

- **评论 Emoji 反应** — 12 个内置表情 + Popover 选择器 + 用户列表 Tooltip
- **拖拽上传** — `dragCounter` 状态机 + 蓝色虚线覆盖层
- **粘贴上传** — `onPaste` 自动命名 `pasted_{ts}.png`
- **工作项订阅/关注** — `WorkItemWatcher` 模型 + 4 个 watch API + 关注按钮 + "我的关注"页面
- **保存筛选条件** — `useSavedFilters` Hook + localStorage 命名空间隔离

## [V1.50] - 2026-07-25

### AI 能力增强

- **AI 长评论摘要** — `summarize-comments` 端点 + `CommentSummaryCard`（决策/问题/行动三列）
- **AI 自然语言搜索** — `nl-search` 端点 + 顶栏 NL 模式
- **AI 重复 Bug 检测** — `check-duplicate-bug` 端点 + `DuplicateBugAlert`（加权相似度）
- **AI 自动分类** — `auto-classify` 合并 `aiFill` + `aiSuggestAssignee`
- **GlobalAIAssistant 上下文记忆** — pathname + 中文页面名注入，MAX_CONTEXT 从 10 增至 20
- **风险预警增强** — Top N=5 + 红点 Badge + 跳转详情
- **周报布局优化** — 关键摘要 section + emoji 徽章

## [V1.49] - 2026-07-25

### 拖拽粘贴与实时协作

- **通用拖拽/粘贴上传 Hook** — `useDragPasteUpload` 抽取复用，支持图片/文件类型限制
- **工作项自动编号链接** — REQ/TASK/BUG/REL 自动链接，覆盖 Markdown/简单 Markdown/评论渲染
- **暗色主题切换** — `ThemeContext` + localStorage 持久化 + 系统偏好跟随
- **撤销/重做 Hook** — `useUndoableState`，50 栈深度 + 同步

### 修复

- 修复 `RiskAlertPanel`/`ReportGenerator`/`DashboardPage` tsc 错误
- 删除 `AI 一键生成报告` 按钮与 `ReportGenerator` Modal（与 AI 周报/月报功能重复）

## [V1.48] - 2026-07-25

### 安全修复 (P0)

#### 后端
- **SSO demo-login 后门修复** — `POST /oauth/:provider/demo-login` 加 `requireRole('tenant_admin')`，防止开发模式任意用户被冒充登录 ([sso.ts](file:///f:/TraeWork/AVM项目中心_Trae版_v1.2/avm-demo/backend/src/routes/sso.ts))
- **SSO bind-sso IDOR 修复** — `POST /users/:id/bind-sso` 与 `unbind-sso` 加本人/tenant_admin 双通过校验
- **Webhook 批量赋值修复** — `PATCH /configs/:id` 字段白名单（禁止改写 spaceId/createdBy）
- **AI configs 越权修复** — POST/PATCH/DELETE 加 `requireRole('space_admin')` + 字段白名单
- **Webhook inbox 路由顺序** — `/inbox/:token` 路由提前到 `requireAuth` 之前注册
- **敏感日志清理** — `aiCommand` 工具调用日志只记录 name；`workItems` 移除请求体日志

#### 前端
- **表单防重复点击** — `useCrudResource` 新增 `submitting` state，7 个表单接入（Customer、CarModel、ReviewDetail、Baseline、WorkItemDetail、ContactList）

### 代码质量 (P1)

- **统一错误处理** — 新增 `utils/apiError.ts`，提供 `extractApiError`/`notifyApiError`/`withApiError`，消除 90+ 处 `catch (e: any) { message.error(...) }` 重复
- **调试 console 清理** — 前端 `useWorkItemChanged` 删除 3 条 console.log；`ws.ts` 用 `import.meta.env.DEV` 门控 6 处 console
- **类型安全修复** — `App.tsx` 用 `useRef<number>(0)` 替代 `(window as any).__avm_lastG`；`ws.ts` 修复 `any` 类型为 `ReturnType<typeof setTimeout> | null`
- **测试覆盖** — 前端 26 + 后端 438 单测通过；新增 Sentry 脱敏测试、apiError 工具测试

### 功能体验 (P2)

- **搜索防抖** — 新增 `useDebouncedValue` hook，300ms 延迟；WorkItemsPage + CustomerPage 接入
- **URL 状态同步** — 新增 `useUrlState` hook，筛选/视图状态同步到 URL，刷新不丢失 + 可分享
- **统一分页** — 新增 `DEFAULT_PAGINATION` 常量，TableView/CustomerPage 接入
- **表格排序** — WorkItemsTable 6 列、CustomerPage 6 列新增 sorter
- **面包屑导航** — 新增 `AppBreadcrumb` 组件；接入 WorkItemDetail/ReviewDetail/DashboardDetail/FlowEditor
- **404 兜底** — 新增 `NotFoundPage` + `Root.tsx` `path="*"` 路由
- **响应式适配** — `App.tsx` Sider 加 `breakpoint="lg"` + `collapsedWidth={0}`；搜索框用 `clamp` 响应式宽度

### DevOps 补齐 (P3)

- **Sentry 错误追踪** — 前后端均已接入（V1.30.3 已就位，本版本做覆盖率补齐）
- **Playwright E2E 框架** — 新增 `playwright.config.ts` + `e2e/main-flow.spec.ts`，覆盖：
  - 5 浏览器（Chrome/Firefox/Safari/Pixel 5/iPhone 13）
  - 登录流程（管理员/项目经理/成员三个角色）
  - 404 兜底
  - 搜索防抖（300ms 内不立即发请求）
  - URL 状态同步
  - 视图切换同步
  - 移动端侧边栏响应式
- **CHANGELOG.md** — 本文件

### 文档

- **Wiki** — 新增/更新 P0/P1/P2/P3 四个概念页（[[P0安全修复与表单防重复]]、[[P1代码质量优化]]、[[P2功能体验优化]]、P3部署补齐）
- **API 文档** — Swagger UI `/api-docs/`（V1.46 已就位）

## [V1.47] - 2026-07-25

### 功能

- **MCP Server 工具全量桥接** — 从 13 个硬编码工具扩展到 124 个（9 核心 + 18 扩展 + 97 QUERY_TOOLS），覆盖所有页面所有功能
- **MCP 用户上下文注入** — 新增 `McpUserContext` 接口（userId/tenantId/role/username/spaceId），三端协议统一
- **LLM 设置页重构** — 从预置厂商表格改为「已配置卡片 + 添加按钮」模式
- **AI 助理页优化** — Add Model 链接改为原生 anchor；上传按钮用 FileOutlined；DeepSeek 选项用自定义 SVG Logo

## [V1.46.x] - 2026-07-24

### 性能

- **React.lazy 路由懒加载** — 28 个低频页面懒加载
- **Vite manualChunks** — 6 个 vendor chunk 分割
- **主 chunk 2.9MB → 170KB**（-94%）

### 通用组件抽取

- 4 个 Hooks：`useAsync` / `useCrudResource` / `useAiFormFiller` / `useExport`
- 7 个组件：`StatsBar` / `FilterBar` / `CrudDrawer` / `PageHeaderBar` / `StateViews` / `AdminOnly` / `tableActionColumn`
- 1 个常量模块：`enumMetadata.ts`
- 1625 行重复代码消除

### API 文档

- `gen-swagger.mjs` 重写为源码扫描
- 43 个路由模块、301 个 API 端点、224 个唯一路径、16 个 tag 分类
- Swagger UI 挂载在 `/api-docs/`

## [V1.30] - 2026-07-23

### 安全

- **Sentry 错误追踪**（前后端）— PII 脱敏（password/secret/token/apiKey 自动过滤）
- **Helmet 安全头** — CSP / HSTS / X-Frame-Options
- **Rate Limit** — 全局限流 + 登录限流
- **CSRF 保护** — double submit cookie
- **生产环境强制校验** — 启动前检查 JWT_SECRET、CORS_ORIGIN、DB 连接

### 可观测性

- **Prometheus 指标** — `/metrics` 端点（请求计数、耗时直方图、活跃连接）
- **结构化日志** — Winston + JSON 格式
- **审计日志** — 8+ 关键操作（登录、CRUD、权限变更）

## [V1.10] - 2026-07-22

### 架构

- **React.lazy 代码分割** — Vite 自动拆分每个页面为独立 chunk
- **Suspense fallback** — 防止路由切换白屏

## [V1.0] - 2026-07-15

### 初始版本

- 工作项（需求/任务/缺陷/发布）CRUD
- 节点流（流程引擎）— TR/DCP/QR 三种评审
- 视图（表格/看板/甘特）
- 客户/车型/项目/迭代/评论/通知
- 基础 AI 能力（智能问答/估分/缺陷归类/周报）
- 5 角色权限（super_admin/space_admin/tenant_admin/pm/member）
- 演示账号一键填充
- Swagger API 文档

---

## 版本规范

- **MAJOR**（主版本）— 不兼容的 API 修改
- **MINOR**（次版本）— 向后兼容的功能新增
- **PATCH**（补丁版本）— 向后兼容的 bug 修复

## 链接

- [Wiki 主页](file:///f:/TraeWork/AVM项目中心_Trae版_v1.2/wiki/index.md)
- [部署就绪度评估](file:///f:/TraeWork/AVM项目中心_Trae版_v1.2/wiki/concepts/P3部署就绪度评估.md)（V1.48 综合 8.5/10）
- [AVM 项目中心 README](file:///f:/TraeWork/AVM项目中心_Trae版_v1.2/avm-demo/README.md)
