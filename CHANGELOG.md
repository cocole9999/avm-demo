# Changelog

AVM 项目中心的所有版本变更记录。本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [V1.55.14] - 2026-07-26

### 模型选择器移至底部输入框（Trae Work 风格）

#### 变更
- **顶部栏精简** — 从顶部栏移除模型选择器（ModelSelector），减少右侧拥挤，腾出空间给会话菜单 / 清空 / 更多
- **底部工具行收纳模型** — 把 ModelSelector 移至输入框下方的工具行最左侧，与「Enter 发送 · Shift+Enter 换行」提示和「发送/停止」按钮同行布局（Trae Work 风格：左工具 + 中提示 + 右发送）
- **提示文案精简** — 删除「N 个工具可用」前缀（信息密度过高），保留核心的「Enter 发送 · Shift+Enter 换行」快捷键提示
- **窄面板适配** — 提示文案加 `overflow: hidden + textOverflow: ellipsis + whiteSpace: nowrap`，避免模型选择器长名称时挤压提示

#### 验证
- `npx tsc --noEmit` 退出码 0

## [V1.55.13] - 2026-07-26

### AI 助理面板 UI 重设计（仿 Trae Work 风格）

#### 变更
- **顶部栏精简** — 去掉冗余的「Agent 名徽章」（与下方 Tab 重复），改为紫蓝渐变胶囊「AI 助理」徽标 + 模型选择器 + 会话菜单 + 清空 + 更多
- **Agent Tab 改 Segmented Chip 风格** — 弃用实色 Button，改为 14px 圆角 chip：激活态用 Agent 主题色背景 + 加粗 + 边框；非激活态透明背景 + 悬停浅灰过渡；过渡 180ms ease
- **空状态大圆头像** — 72×72 圆角方块，Agent 主题色渐变背景 + 30px 居中图标 + 主题色阴影；标题 16px / 600 / 字距 0.2，描述 13px / 1.7 行高，居中 280px 宽度
- **空状态分隔线** — 36×2 圆角分隔条 + 精致快捷键 `<kbd>` 标签（白色背景 + 1px 边框 + 阴影）
- **消息气泡精致化** — 用户气泡用主题色实色背景 + 主题色 30% 阴影；AI 气泡用白底 + 1px 边框 + 极淡阴影；时间戳颜色随气泡主题调整
- **输入框聚焦动效** — 圆角 12 容器，聚焦时边框转主题色 + 3px 主题色浅背景光环，失焦恢复
- **工具栏提示文案对齐** — 底部「N 个工具可用 · Enter 发送 · Shift+Enter 换行」与「发送/停止」按钮底对齐，发送按钮圆角 8

#### 验证
- `npx tsc --noEmit` 退出码 0
- 6 个 Agent chip 颜色（蓝/青/橙/紫/红/绿）一一对应，与空状态大头像保持一致

## [V1.55.12] - 2026-07-26

### 移除顶部全局搜索框

#### 变更
- **移除顶部搜索框** — 删除 Header 中"机器人按钮 + Input.Search/AutoComplete + NL 解析弹层 + 关键词搜索结果弹层"的整个组合，理由：边框+阴影在小尺寸下显得画蛇添足，且与 AI 助理存在功能重叠
- **检索能力移交 AI 助理** — 关键词搜索与 NL 自然语言搜索（"上周延期项目"等）改由 GlobalAIAssistant 提供，用户可通过 Logo 左侧 AI 按钮或 `Ctrl+K` 唤起
- **代码清理** — 删除 `searchQ / searchResults / nlMode / nlLoading / nlResult` 五个 state 与 `handleNlSearch / handleNlNavigate / handleSearch` 三个 handler；清理 `AutoComplete / Input / Spin`（antd）与 `RobotOutlined / ArrowRightOutlined`（icons）以及 `searchApi`（api）共 6 处不再使用的 import

#### 验证
- `npx tsc --noEmit` 退出码 0，类型检查通过
- 顶栏右侧释放的宽度自动由工作项统计 / 收藏 / 通知 三个模块吸收，布局更宽松

## [V1.55.10] - 2026-07-26

### AI 助理悬浮按钮移至 Sider Logo 左侧

#### 变更
- **AI 按钮位置** — 从右下角 56x56 悬浮按钮改为 Sider 头部 Logo 左侧的 28x28 紧凑按钮
- **按钮样式** — 已配置 LLM 时显示紫蓝渐变 + boxShadow，未配置时显示灰色
- **数字徽章** — Badge 显示用户消息数（通过 sessionStorage 轮询同步 GlobalAIAssistant 的历史）
- **LLM 状态指示** — Tooltip 提示"AI 助理 (Ctrl+K) — 已就绪/未配置 LLM"
- **快捷键** — Ctrl+K 唤起/关闭全局 AI 助理（原 Ctrl+K 行为保留到新按钮）
- **布局适配** — Sider 头部从居中改为左对齐，padding：折叠 8px，展开 16px；标题过长省略
- **GlobalAIAssistant 改造** — 新增 `props.open / onOpenChange / hideFloatButton`，支持外部控制 Drawer 开关和隐藏内置 FloatButton

## [V1.55.9] - 2026-07-26

### AI Agent 系统 5 项 bug 修复

#### 修复
- **NL 搜索响应慢无反馈** — 用户输入"上周延期项目"后看不到任何反馈。新增"AI 正在解析查询条件…"loading 弹层，点击搜索后立即显示
- **NL 解析结果弹层定位错位** — 弹层 `top: 40px; right: 0` 导致 480px 宽弹层向左溢出 320px 的搜索框容器。改为 `top: 100%; left: 0` 对齐搜索框左边缘
- **关键词搜索结果弹层偏离** — 搜索结果 `right: max(16px, calc((100vw - 720px) / 2))` 在 1440px 视口下偏移 360px。移入 relative 容器内，统一 `top: 100%; left: 0`
- **AI 面板窄宽度工具栏溢出** — 280px 面板宽度下工具栏需要 416px 导致溢出。响应式隐藏：`width < 320` 隐藏"AI 助理"标题，`< 360` 隐藏 Agent 名标签，`< 380` 隐藏模型选择器
- **AI 输入框回车无内容显示** — 根因：`ensureSession` 创建新 session 后调用 `panel.setSessionId(s.id)`，触发 `useEffect` 异步加载 session 消息（此时为空），覆盖了 `sendMessage` 刚添加的 userMsg 和 aiMsg。修复：用 `justCreatedSessionRef` 标记刚创建的 session，让 `useEffect` 跳过加载
- **后端 LLM 空回复兜底** — `aiCommand /command` 接口当 LLM 返回空 content 且无 tool_calls 时，`finalContent` 为空字符串。新增兜底：返回"AI 返回了空内容"提示

## [V1.55.8] - 2026-07-26

### 布局错乱修复

#### 修复
- **AI 面板消息区空状态被推出视口** — 外层 `<Layout minHeight: 100vh>` 被 Sider 的长菜单拉长至 3077px，导致 AI 面板 `<aside>` 高度也变成 2981px，消息区空状态因 `justifyContent: center` 被居中到 y=1430px（视口外）。修复后外层 Layout 固定 `height: 100vh` + `overflow: hidden`，AI 面板 ASIDE 高度回落至 804px（视口内）
- **Content 高度溢出** — Content 增加 `height: calc(100vh - 64px - 32px)` 显式约束，避免被工作台内容（1032px）拉长
- **Sider 长菜单溢出** — Sider 内部用 `flex column` + `Menu overflowY: auto` + 迭代列表 `maxHeight: 40%` 三段式布局，菜单可独立滚动
- **AI 面板消息区 minHeight: 0** — flex 容器内 minHeight: 0 避免被 flex 默认行为拉伸，空状态改为顶部对齐（`paddingTop: 60`）保证内容显示在视口内

#### 验证
- 截图：1440x900 视口下 AI 面板完整显示，Header 搜索框/通知/用户头像不被覆盖
- 跨页验证：工作台 / 项目管理 / 任务管理 / LLM 设置 / 报告均布局正确

## [V1.55.7] - 2026-07-26

### Agent 面板 UI 优化

#### 修复
- **输入框丢失问题** — 重写输入框容器，使用 `flexShrink: 0` + 圆角边框 + 顶部阴影确保输入框始终可见，不再被消息区挤压裁剪

#### 改进
- **6 个专用 Agent 图标重新设计** — 从 emoji 升级为彩色圆形徽章（圆形背景 + 居中 antd 图标），辨识度更高、与左侧导航视觉一致
  - 通用（蓝）：`RobotOutlined`
  - 项目（青）：`ProjectOutlined`
  - 工作项（橙）：`UnorderedListOutlined`
  - 报告（紫）：`SnippetsOutlined`
  - 风险（红）：`AlertOutlined`
  - 评审（绿）：`MessageOutlined`
- 顶部状态徽章、Tab 按钮、空状态、提示气泡均使用新的徽章设计
- 提示文本补充 `Enter` / `Shift+Enter` 快捷键说明

## [V1.55.6] - 2026-07-26

### Agent 反馈与统计

#### 新增
- **消息反馈 API** — `POST /api/agent-feedback` 提交点赞/点踩（按 sessionId+messageId+userId 幂等 upsert），`GET /api/agent-feedback/by-message/:sessionId/:messageId` 查询单条消息反馈，`DELETE /api/agent-feedback/:id` 取消（仅本人 / 管理员）
- **Agent 使用统计 API** — `GET /api/agent-feedback/stats` 返回总反馈数 / 点赞率 / 各 Agent 会话数（管理员可见）
- **新数据模型** — `AgentMessageFeedback`（id / sessionId / messageId / userId / rating / comment / createdAt）
- **`MessageFeedbackBar` 组件** — 嵌入 AgentPane 的 AI 消息下方，点赞 / 点踩 / 评论三件套
  - 自动加载本条消息的累计反馈 + 当前用户的反馈
  - 未反馈：显示两个 outlined 图标按钮
  - 已反馈：高亮实心图标，再次点击取消
  - 评论 Popover：可补充最多 500 字说明，自动同步到后端
- **`AgentStatsPage` 页面** — `/agent-stats` 管理员看板
  - 4 张核心卡片：总反馈数 / 点赞 / 点踩 / 点赞率
  - Agent 会话数排行表（含禁用状态、进度条）
  - 反馈分布（点赞/点踩百分比可视化）
  - 面包屑：工作台 / AI 助理 / Agent 统计

#### 导航与集成
- **`AIPage` 顶部** — 新增「Agent 统计」快捷链接
- **左侧导航「系统管理」分组** — 新增「Agent 统计」入口
- **AppBreadcrumb / selectedKey / 页面标题** — 同步添加 agent-stats 路径

#### 数据契约
- 反馈表 Prisma 模型 + `agentFeedback` 审计实体类型
- 当前用户从 `localStorage.avm-user-name` 读取用于匹配"我的反馈"

## [V1.55.5] - 2026-07-26

### Agent 会话增强

#### 新增
- **SessionMenu 组件** — Trae Work 风格会话侧边菜单
  - 当前 Agent 全部会话列表（按更新时间倒序）
  - 点击切换会话 + 自动恢复 agentKey
  - 右上角「新建会话」按钮
- **Agent Session URL 分享** — `?agentSession=xxx` 进入时自动加载对应会话
- **SessionMenu API 增强** — `fork` 端点（保留消息历史 + 复制标题 + 标记 forkedFrom）
- **`append` 端点** — 增量追加消息到会话（用于流式输出中途保存）

## [V1.55.4] - 2026-07-26

### Agent 切换与并发控制

#### 新增
- **InlineAskButton 组件** — 划词唤起 AI 助理
  - 监听文本选区变化，浮动按钮出现在选区右上
  - 提供「解释这段 / 总结这段 / 翻译成中文 / 提问这段」4 个快捷动作
  - 点击后通过 sessionStorage 注入 prompt 并打开 Agent 面板
- **`useAgentPendingPrompt` Hook** — 跨组件消费待发送 prompt
- **useResizablePanel Hook** — Agent 面板可调宽度（280-720px），localStorage 持久化
- **AgentPane 嵌入导航栏** — Trae Work 风格布局：Sider | Content | AgentPane
- **Detached 浮层模式** — Agent 面板可分离为右下角浮窗（FullscreenOutlined 切换）
- **Ctrl+U 快捷键** — 切换 Agent 面板显隐

## [V1.55.3] - 2026-07-26

### Agent 模型与工具管理

#### 新增
- **ModelSelector 组件** — Agent 面板顶部下拉，可选 provider+model，覆盖全局 LLM 设置
- **Agent 与 LLM 关联** — Agent.llmConfigId 字段关联 LLMSettings 表，null 时回退到用户默认

## [V1.55] - 2026-07-26

### AI 专用 Agent 系统

#### 数据模型
- **`Agent` 模型** — 6 个内置专用助理（项目/工作项/报告/风险/评审/通用）
  - 字段：key / name / description / icon / systemPrompt（模板）/ scope（global|page）/ allowedPages / allowedTools / llmConfigId / order / enabled
  - `@@unique([spaceId, key])` 约束
- **`AgentSession` 模型** — 云端持久化会话
  - 字段：agentId / userId / userName / title / messages（JSON）/ metadata（JSON：含 page / contextSnapshot / model / agentKey）

#### API
- `GET/POST/PATCH /api/agents` — 6 个内置 Agent 的 CRUD（管理员可编辑 systemPrompt）
- `POST /api/agents/seed/builtin` — 幂等 upsert 内置 Agent
- `GET/POST/PATCH/DELETE /api/agent-sessions` — 会话管理
- `POST /api/agent-sessions/:id/fork` — Trae Work 风格 Fork
- `POST /api/agent-sessions/:id/append` — 增量追加

#### 智能路由
- **`agentPrompts.ts` 6 套系统 Prompt** — 通用 / 项目 / 工作项 / 报告 / 风险 / 评审
  - 每套支持 `{{user}} {{page}} {{pageName}} {{context}} {{date}}` 变量
  - 每套独立的 `allowedTools` 白名单（`[]` = 全量）
  - 每套独立的 `allowedPages` 范围控制

## [V1.54] - 2026-07-25

### 安全依赖与基线加固

#### 安全修复
- **xlsx → exceljs 迁移** — 移除 `xlsx@0.18.5`（已知原型污染 + ReDoS 漏洞无上游修复），替换为 `exceljs@^4.4.0`
  - `fileParser.ts` — xlsx 解析改用 `ExcelJS.Workbook().xlsx.load()`，提取前 100 行
  - `export.ts` — xlsx 导出改用 `ws.addRow()`；CSV 序列化独立实现（RFC 4180 转义 + UTF-8 BOM）
  - `imports.ts` — xlsx 导入按行 + 单元格读取，首行作 header
  - 已知限制：`.xls` 旧格式 exceljs 不支持（场景概率极低，接受）

#### 测试基线
- **覆盖率门槛（防倒退）** — `vitest.config.ts` 新增 thresholds 配置（实测值 -1% 缓冲）
  - 后端：lines 9% / functions 13% / branches 8% / statements 9% + `reportOnFailure: true`
  - 前端：lines 3% / functions 1% / branches 2% / statements 3%
  - 策略说明：vitest `thresholds` 不支持 per-glob，全局高门槛会卡未测试模块，故采用"全局低门槛防倒退 + 局部高覆盖模块作参考"

#### 性能基线
- **autocannon 压测基线** — 因 k6 v0.57.0 二进制从 GitHub 下载受国内网络限制，改用 `autocannon` 作为等效替代
  - 新增 `perf/autocannon-runner.mjs` — 3 个场景对齐 k6 脚本（login 50 并发 30s / workitems 100 并发 60s / ai-command 5 并发 30s）
  - 新增 `perf/baseline-report.json` — 基线数据：workitems p97.5=556ms ✓达标 0 错误 / login p97.5=5603ms（瓶颈 bcrypt rounds=10 + DB 连接池 5）
  - 字段映射：`p(95)` → `latency.p97_5`（autocannon 无原生 p95）/ `http_req_failed` → 手算 `(non2xx + errors) / total`

#### 修复
- **GlobalAIAssistant 配置模型跳转修复** — `window.open('/llm-settings', '_blank')` 被 Popup 拦截器静默拦截，改用 `useNavigate` SPA 跳转，同时修复"添加模型" `<a href>` 整页刷新问题
- **dev 环境放宽 loginLimiter** — `max: 5 → 100000`（生产仍 5），避免 coverage 套件间触发 429

### 生产建议（待落地）
- 登录瓶颈：降 `BCRYPT_ROUNDS` 到 8 / 缓存 token / 提高 `connectionLimit` 20-50
- 配置 LLM provider 后重跑 ai-command 压测
- 将 `perf/autocannon-runner.mjs` 接入 CI 周度跑一次对比基线

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
