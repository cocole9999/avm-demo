import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 覆盖 AVM 项目中心 5 条关键用户路径
 */
export default defineConfig({
  testDir: './e2e',
  // E2E 测试串行执行，避免后端数据竞争
  fullyParallel: false,
  workers: 1,
  // 单个测试超时 60s（AI 操作可能较慢）
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // 失败重试
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer 不自动启动，假设前后端已手动启动
  // 前端: cd frontend && npm run dev (端口 5173)
  // 后端: cd backend && npm run dev (端口 4000)
});
