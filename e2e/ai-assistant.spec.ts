import { test, expect } from '@playwright/test';
import { login } from './utils';

/**
 * 全局 AI 助理测试
 * 覆盖：Ctrl+K / 浮窗按钮唤起抽屉、输入并发送问题
 * 注意：AI 依赖 LLM 配置，测试仅验证 UI 交互，不硬断言 LLM 返回内容
 * 依据：frontend/src/components/GlobalAIAssistant.tsx
 */
test.describe('全局 AI 助理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('通过 Ctrl+K 快捷键打开 AI 助理抽屉', async ({ page }) => {
    await page.goto('/workbench');
    await page.waitForLoadState('networkidle');

    // 使用 Ctrl+K 唤起 AI 助理
    await page.keyboard.press('Control+k');

    // 验证抽屉标题可见
    await expect(page.getByText('AVM 全局 AI 助理').first()).toBeVisible({ timeout: 10_000 });

    // 验证快捷键提示标签存在
    await expect(page.getByText('Ctrl+K').first()).toBeVisible();

    // 验证输入框存在
    await expect(
      page.getByPlaceholder('帮你编写代码、调试 Bug、优化性能等开发工作，交付生产级代码产物。')
    ).toBeVisible();

    // 按 Escape 关闭抽屉
    await page.keyboard.press('Escape');
  });

  test('点击浮窗按钮打开并输入问题发送', async ({ page }) => {
    await page.goto('/workbench');
    await page.waitForLoadState('networkidle');

    // 点击右下角悬浮 AI 按钮
    await page.getByRole('button', { name: '打开 AI 助理' }).click();

    // 验证抽屉已打开
    await expect(page.getByText('AVM 全局 AI 助理').first()).toBeVisible({ timeout: 10_000 });

    // 定位输入框并输入问题
    const inputBox = page.getByPlaceholder(
      '帮你编写代码、调试 Bug、优化性能等开发工作，交付生产级代码产物。'
    );
    const question = '帮我创建一个P0优先级的需求，标题是登录页面优化';
    await inputBox.fill(question);

    // 验证输入内容已填入
    await expect(inputBox).toHaveValue(question);

    // 按 Enter 发送（onPressEnter 支持，避免依赖无文本的发送按钮）
    await inputBox.press('Enter');

    // 验证用户消息出现在对话区（确认发送成功）
    await expect(page.getByText(question).first()).toBeVisible({ timeout: 10_000 });

    // 宽松验证：等待 AI 响应迹象，不硬断言 LLM 返回内容
    // 出现"AI 思考中"loading 或任何 AI 回复即算通过；LLM 未配置时也不应失败
    const aiThinking = page.getByText('AI 思考中').first();
    await aiThinking.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {
      // loading 可能已结束（很快返回或很快报错），不算失败
    });
  });
});
