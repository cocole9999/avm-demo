import { test, expect } from '@playwright/test';

/**
 * 登录流程测试
 * 覆盖：管理员快速填充登录、错误密码提示、成员账号登录
 * 依据：frontend/src/pages/LoginPage.tsx
 */
test.describe('登录流程', () => {
  test('管理员标签快速填充并登录成功跳转到首页', async ({ page }) => {
    await page.goto('/login');

    // 点击"租户管理员"标签自动填充账号
    await page.getByText('租户管理员').click();

    // 验证表单已自动填充
    await expect(page.getByPlaceholder('用户名')).toHaveValue('admin');
    await expect(page.getByPlaceholder('密码')).toHaveValue('Admin@2026');

    // 提交登录
    await page.getByRole('button', { name: '登录' }).click();

    // 验证跳转到工作台（登录后默认路由）
    await page.waitForURL('**/workbench', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/workbench/);

    // 验证主框架已加载（侧边栏标题可见）
    await expect(page.getByText('AVM 项目中心').first()).toBeVisible();
  });

  test('错误密码登录失败显示错误提示', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('WrongPassword@123');
    await page.getByRole('button', { name: '登录' }).click();

    // 验证仍在登录页（未跳转）
    await expect(page).toHaveURL(/\/login/);

    // 验证错误提示出现（antd Alert 组件 role=alert）
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  });

  test('普通成员账号登录成功', async ({ page }) => {
    await page.goto('/login');

    // 点击"普通成员"标签自动填充
    await page.getByText('普通成员').click();

    // 验证表单已填充（zhangsan 而非 member，以代码为准）
    await expect(page.getByPlaceholder('用户名')).toHaveValue('zhangsan');

    await page.getByRole('button', { name: '登录' }).click();

    // 验证跳转到工作台
    await page.waitForURL('**/workbench', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/workbench/);
  });
});
