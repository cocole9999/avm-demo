# AVM 项目中心 E2E 测试

基于 Playwright 的端到端测试套件，覆盖 5 条关键用户路径。

## 测试覆盖

| 文件 | 用例数 | 覆盖路径 |
|------|--------|----------|
| `login.spec.ts` | 3 | 管理员快速填充登录、错误密码提示、成员账号登录 |
| `workitem.spec.ts` | 2 | 新建工作项并在列表可见、查看工作项详情页 |
| `review.spec.ts` | 2 | 查看评审列表、进入评审详情验证状态展示 |
| `dashboard.spec.ts` | 2 | 统计卡片与图表加载、切换健康度维度视图 |
| `ai-assistant.spec.ts` | 2 | Ctrl+K 唤起 AI 助理、点击浮窗输入并发送问题 |

## 前置条件

### 1. 启动后端服务（端口 4000）

```bash
cd avm-demo/backend
npm install
npm run dev
```

### 2. 启动前端服务（端口 5173）

```bash
cd avm-demo/frontend
npm install
npm run dev
```

### 3. 安装 Playwright 依赖

在 `avm-demo` 根目录执行：

```bash
npm install
npx playwright install chromium
```

> 首次运行 `npx playwright install` 会下载 Chromium 浏览器（约 150MB）。

## 运行测试

### 全部测试

```bash
cd avm-demo
npx playwright test
```

### 带浏览器界面运行（调试用）

```bash
npx playwright test --headed
```

### 调试模式（步进执行 + Inspector）

```bash
npx playwright test --debug
```

### 运行单个测试文件

```bash
npx playwright test e2e/login.spec.ts
```

### 运行指定用例（按名称过滤）

```bash
npx playwright test -g "管理员标签快速填充"
```

## 演示账号

> ⚠️ 以下凭据来自 `frontend/src/pages/LoginPage.tsx`，与任务描述中的部分账号不同，以代码为准。

| 角色 | 用户名 | 密码 | 标签 |
|------|--------|------|------|
| 租户管理员 | `admin` | `Admin@2026` | 租户管理员 |
| 空间管理员 | `pm` | `Pm2026!!` | 空间管理员 |
| 普通成员 | `zhangsan` | `User@2026` | 普通成员 |

## 注意事项

1. **测试串行执行**：配置 `workers: 1`，避免后端数据竞争
2. **超时 60s**：AI 相关操作可能较慢，单测超时设为 60 秒
3. **AI 助理测试**：仅验证 UI 交互（抽屉打开/输入/发送），不硬断言 LLM 返回内容，因 AI 依赖 LLM 配置
4. **空列表处理**：工作项详情和评审详情测试在列表为空时会自动跳过（`test.skip`）
5. **webServer 未配置**：测试假设前后端已手动启动，不自动拉起服务

## 测试报告

运行完成后，HTML 报告生成在 `avm-demo/playwright-report/` 目录：

```bash
npx playwright show-report
```
