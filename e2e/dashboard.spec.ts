import { test, expect } from '@playwright/test';
import { login } from './utils';

/**
 * 项目仪表盘测试
 * 覆盖：统计卡片与图表加载、切换健康度维度视图
 * 依据：frontend/src/pages/DashboardPage.tsx
 */
test.describe('项目仪表盘', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('验证仪表盘统计卡片与图表加载', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 验证 4 个顶部统计卡片加载
    await expect(page.getByText('总工作项').first()).toBeVisible();
    await expect(page.getByText('P0 / P1 紧急项').first()).toBeVisible();
    await expect(page.getByText('未关闭缺陷').first()).toBeVisible();
    await expect(page.getByText('活跃迭代').first()).toBeVisible();

    // 验证"状态分布"卡片加载
    await expect(page.getByText('状态分布').first()).toBeVisible();

    // 验证"AI 周报 / 月报"区域加载
    await expect(page.getByText('AI 周报 / 月报').first()).toBeVisible();

    // 验证周报/月报切换按钮存在
    await expect(page.getByRole('button', { name: '周报', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '月报', exact: true })).toBeVisible();
  });

  test('切换健康度维度视图（客户 ↔ 车型）', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 验证健康度维度卡片存在
    await expect(page.getByText('健康度维度').first()).toBeVisible();

    // 默认显示"按客户"
    await expect(page.getByText('按客户').first()).toBeVisible();

    // 点击"车型"按钮切换视图
    await page.getByRole('button', { name: '车型', exact: true }).click();

    // 验证切换为"按车型"
    await expect(page.getByText('按车型').first()).toBeVisible({ timeout: 5_000 });

    // 切换回"客户"
    await page.getByRole('button', { name: '客户', exact: true }).click();
    await expect(page.getByText('按客户').first()).toBeVisible({ timeout: 5_000 });
  });
});
