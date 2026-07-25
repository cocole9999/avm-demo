import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 配置 (V1.48 P3-部署补齐)
 *
 * 启动流程：
 *   1. `npm run e2e:server`  →  后端 + 前端 dev server (via concurrently)
 *   2. `npm run e2e`         →  Playwright 自动复用 webServer 启动
 *
 * 覆盖矩阵：
 *   - chromium (桌面 Chrome)
 *   - webkit  (Safari)
 *   - firefox (Firefox)
 *   - Mobile Chrome (Pixel 5)
 *   - Mobile Safari (iPhone 13)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 桌面 Chrome
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: process.env.E2E_NO_SERVER ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
