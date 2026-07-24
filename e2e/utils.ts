import type { Page } from '@playwright/test';

/**
 * 演示账号（来源：frontend/src/pages/LoginPage.tsx）
 * 注意：实际密码与任务描述不同，以代码为准
 */
const DEMO_ACCOUNTS = {
  admin: { username: 'admin', password: 'Admin@2026', label: '租户管理员' },
  pm: { username: 'pm', password: 'Pm2026!!', label: '空间管理员' },
  member: { username: 'zhangsan', password: 'User@2026', label: '普通成员' },
} as const;

export type Role = keyof typeof DEMO_ACCOUNTS;

/**
 * 通过 UI 登录指定角色
 * 登录成功后跳转到工作台
 */
export async function login(page: Page, role: Role): Promise<void> {
  const { username, password } = DEMO_ACCOUNTS[role];
  await page.goto('/login');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  // 登录成功跳转到受保护页面（默认 /workbench）
  await page.waitForURL(/\/(workbench|dashboard|work-items|reviews|dashboards)/, {
    timeout: 30_000,
  });
}

export { DEMO_ACCOUNTS };
