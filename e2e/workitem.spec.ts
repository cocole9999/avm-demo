import { test, expect } from '@playwright/test';
import { login } from './utils';

/**
 * 工作项管理测试
 * 覆盖：新建工作项（标题+类型+优先级）并在列表可见、查看详情页
 * 依据：frontend/src/pages/WorkItemsPage.tsx, WorkItemDetailPage.tsx
 */
test.describe('工作项管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('新建需求并验证在列表中可见', async ({ page }) => {
    // 进入需求列表页
    await page.goto('/work-items/requirement');
    await page.waitForLoadState('networkidle');

    // 点击"新建需求"按钮
    await page.getByRole('button', { name: /新建需求/ }).click();

    // 验证创建弹窗出现
    await expect(page.getByText('新建需求').first()).toBeVisible();

    // 填写标题（带时间戳保证唯一性）
    const title = `E2E自动化测试需求_${Date.now()}`;
    await page.getByPlaceholder('一句话描述清楚这个工作项').fill(title);

    // 选择优先级为 P1（默认 P2，改为 P1 验证选择交互）
    await page.getByLabel('优先级').click();
    await page.getByRole('option', { name: 'P1', exact: true }).click();

    // 点击创建按钮
    await page.getByRole('button', { name: '创建', exact: true }).click();

    // 验证成功提示
    await expect(page.getByText('创建成功')).toBeVisible({ timeout: 15_000 });

    // 验证列表中出现新建的标题
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  });

  test('查看工作项详情页内容', async ({ page }) => {
    await page.goto('/work-items/requirement');
    await page.waitForLoadState('networkidle');

    // 列表可能为空，点击第一条工作项标题进入详情
    const firstItemLink = page.locator('table a').first();
    const hasItems = await firstItemLink.count();

    test.skip(hasItems === 0, '工作项列表为空，跳过详情页测试');

    await firstItemLink.click();

    // 验证进入详情页
    await page.waitForURL('**/work-items/requirement/**', { timeout: 15_000 });

    // 验证详情页关键信息区域存在
    await expect(page.getByText('状态').first()).toBeVisible();
    await expect(page.getByText('优先级').first()).toBeVisible();

    // 验证返回按钮存在
    await expect(page.getByRole('button', { name: /返回/ })).toBeVisible();
  });
});
