import { test, expect } from '@playwright/test';
import { login } from './utils';

/**
 * 评审流程测试
 * 覆盖：查看评审列表、进入评审详情验证状态展示
 * 依据：frontend/src/pages/ReviewsPage.tsx, ReviewDetailPage.tsx
 */
test.describe('评审中心', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('查看评审列表', async ({ page }) => {
    await page.goto('/reviews');
    await page.waitForLoadState('networkidle');

    // 验证评审中心标题
    await expect(page.getByText('评审中心').first()).toBeVisible();

    // 验证"发起评审"按钮存在
    await expect(page.getByRole('button', { name: '发起评审' })).toBeVisible();

    // 验证表格表头加载（评审标题列）
    await expect(page.getByText('评审标题').first()).toBeVisible();

    // 验证类型列存在
    await expect(page.getByText('类型').first()).toBeVisible();

    // 验证状态列存在
    await expect(page.getByText('状态').first()).toBeVisible();
  });

  test('进入评审详情验证状态展示', async ({ page }) => {
    await page.goto('/reviews');
    await page.waitForLoadState('networkidle');

    // 查找"查看"按钮（列表可能为空）
    const viewButtons = page.getByRole('button', { name: '查看' });
    const count = await viewButtons.count();
    test.skip(count === 0, '评审列表为空，跳过详情测试');

    // 点击第一条评审的"查看"按钮
    await viewButtons.first().click();

    // 验证进入详情页
    await page.waitForURL('**/reviews/**', { timeout: 15_000 });

    // 验证"返回"按钮存在
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible();

    // 验证评审状态标签展示（待评审/评审中/已通过/已驳回 之一）
    const statusTexts = ['待评审', '评审中', '已通过', '已驳回'];
    const statusVisible = await Promise.all(
      statusTexts.map((s) => page.getByText(s, { exact: true }).first().isVisible())
    );
    expect(statusVisible.some(Boolean)).toBeTruthy();

    // 验证评审类型标签展示（技术评审 TR / 决策评审 DCP / 质量评审 QR 之一）
    const typeTexts = ['技术评审 TR', '决策评审 DCP', '质量评审 QR'];
    const typeVisible = await Promise.all(
      typeTexts.map((t) => page.getByText(t, { exact: true }).first().isVisible())
    );
    expect(typeVisible.some(Boolean)).toBeTruthy();
  });
});
