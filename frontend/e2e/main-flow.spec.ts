/**
 * E2E 主流程测试 (V1.48 P3-部署补齐)
 *
 * 覆盖：
 * 1. 登录页加载 + 演示账号快速填充
 * 2. 登录成功跳转工作台
 * 3. 侧边栏菜单导航
 * 4. 404 兜底
 * 5. 移动端侧边栏响应式收起
 * 6. 工作项列表 + 搜索防抖 + URL 状态同步
 */
import { test, expect } from '@playwright/test';

test.describe('登录与导航', () => {
  test('登录页加载并显示演示账号标签', async ({ page }) => {
    await page.goto('/login');

    // 标题
    await expect(page.getByRole('heading', { name: /AVM 项目中心/ })).toBeVisible();

    // 演示账号标签（管理员/项目经理/成员）
    await expect(page.getByText('管理员', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('项目经理', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('成员', { exact: false }).first()).toBeVisible();

    // 登录按钮
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible();
  });

  test('点击"管理员"标签自动填充演示账号', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('管理员', { exact: false }).first().click();

    // username 输入框应已填充
    const usernameInput = page.locator('input[placeholder*="用户名"], input[id="username"]').first();
    await expect(usernameInput).not.toHaveValue('');
  });

  test('登录成功跳转到工作台', async ({ page }) => {
    await page.goto('/login');
    // 选管理员
    await page.getByText('管理员', { exact: false }).first().click();
    // 提交
    await page.getByRole('button', { name: /登\s*录/ }).click();

    // 等待跳转
    await page.waitForURL(/\/workbench/, { timeout: 10_000 });

    // 工作台标题或工作台菜单项可见
    await expect(page.getByText('工作台').first()).toBeVisible();
  });
});

test.describe('路由兜底', () => {
  test('访问不存在路径显示 404', async ({ page }) => {
    // 登录后访问
    await page.goto('/login');
    await page.getByText('管理员', { exact: false }).first().click();
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL(/\/workbench/);

    // 访问不存在的路径
    await page.goto('/this-path-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('返回工作台')).toBeVisible();
  });
});

test.describe('侧边栏导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByText('管理员', { exact: false }).first().click();
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL(/\/workbench/);
  });

  test('点击菜单跳转到工作项管理', async ({ page }) => {
    await page.getByRole('link', { name: /需求管理/ }).first().click();
    await page.waitForURL(/\/work-items\/requirement/);
    await expect(page.getByText('搜索标题', { exact: false }).first()).toBeVisible();
  });

  test('点击菜单跳转到客户管理', async ({ page }) => {
    await page.getByRole('link', { name: /客户管理/ }).first().click();
    await page.waitForURL(/\/customers/);
    // 顶部统计
    await expect(page.getByText('客户总数', { exact: false })).toBeVisible();
  });
});

test.describe('工作项搜索防抖 + URL 状态', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByText('管理员', { exact: false }).first().click();
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL(/\/workbench/);
  });

  test('搜索框输入后 300ms 内不立即发请求', async ({ page }) => {
    await page.goto('/work-items/requirement');
    await page.waitForLoadState('networkidle');

    // 监听 network
    let reqCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/work-items') && req.url().includes('q=')) {
        reqCount += 1;
      }
    });

    // 快速输入
    const search = page.locator('input[placeholder*="搜索标题"]').first();
    await search.fill('AVM');
    await page.waitForTimeout(100);

    // 100ms 内不应该有 q= 的请求
    expect(reqCount).toBe(0);

    // 等防抖完成
    await page.waitForTimeout(400);
    expect(reqCount).toBeGreaterThanOrEqual(1);
  });

  test('URL 同步搜索关键字', async ({ page }) => {
    await page.goto('/work-items/requirement');
    await page.waitForLoadState('networkidle');

    const search = page.locator('input[placeholder*="搜索标题"]').first();
    await search.fill('透明');
    await page.waitForTimeout(500);

    // URL 应包含 q=
    expect(page.url()).toMatch(/q=/);
  });

  test('视图切换同步到 URL', async ({ page }) => {
    await page.goto('/work-items/requirement');
    await page.waitForLoadState('networkidle');

    // 切换到看板
    await page.getByText('看板', { exact: true }).first().click();
    await page.waitForTimeout(300);

    expect(page.url()).toMatch(/view=kanban/);
  });
});

test.describe('响应式适配', () => {
  test('移动端侧边栏默认收起', async ({ page, isMobile }) => {
    test.skip(!isMobile, '仅在移动设备下运行');

    await page.goto('/login');
    await page.getByText('管理员', { exact: false }).first().click();
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL(/\/workbench/);

    // Sider 收起后宽度应为 0
    const sider = page.locator('aside').first();
    const box = await sider.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(0);
  });
});
