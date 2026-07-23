"""V1.6.8 UI 验证: 切模型 → AI 页 qa → 看 UI 是否带新 model
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    fail = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        # 1. 登录
        await page.goto('http://localhost:5173/login')
        await page.wait_for_timeout(800)
        await page.fill('input[id="username"]', 'admin')
        await page.fill('input[id="password"]', 'admin123')
        await page.click('button:has-text("登录")')
        await page.wait_for_timeout(1500)
        print('✓ 登录 admin')

        # 2. 进 LLM 设置
        await page.goto('http://localhost:5173/llm-settings')
        await page.wait_for_timeout(1500)

        # 配置 DeepSeek
        # 找"配置"按钮 (DeepSeek row)
        try:
            await page.click('text=DeepSeek', timeout=2000)
            await page.wait_for_timeout(500)
        except: pass

        # 找"添加 API Key" 或 直接填表单
        # 看下当前 UI
        body = await page.content()
        if 'DeepSeek' in body and '未配置' in body:
            print('  DeepSeek 未配置, 尝试配置')
            # 找 input[type=password] 或 input placeholder
            try:
                api_input = page.locator('input[placeholder*="API"]').first
                if await api_input.count() > 0:
                    await api_input.fill('sk-test-1234567890')
            except: pass

        await page.wait_for_timeout(500)
        await page.screenshot(path='/tmp/llm-config.png')
        print('  已截图 /tmp/llm-config.png')

        # 3. 切到 v4-flash
        try:
            # 找 v4-flash tag 点击
            tag = page.locator('text=deepseek-v4-flash').first
            await tag.click(timeout=2000)
            await page.wait_for_timeout(1500)
            print('✓ 点击 v4-flash tag')
        except Exception as e:
            print(f'  ! 找不到 v4-flash tag: {e}')

        # 4. 进 AI 页
        await page.goto('http://localhost:5173/ai')
        await page.wait_for_timeout(1500)

        # 5. 问问题
        await page.fill('textarea', 'P0 多少个？')
        await page.keyboard.press('Enter')
        await page.wait_for_timeout(2500)

        # 6. 检查回答区域
        ai_text = await page.locator('body').inner_text()
        await page.screenshot(path='/tmp/ai-qa.png', full_page=True)

        # 看是否有"调用模型"或"v4-flash"字样
        has_model = 'v4-flash' in ai_text
        has_p0 = 'P0' in ai_text and '6' in ai_text
        print(f'  answer contains v4-flash: {has_model}')
        print(f'  answer contains P0/6: {has_p0}')

        if not has_model:
            fail.append('AI 页未显示当前模型 v4-flash')
        if not has_p0:
            fail.append('AI 页未正确回答 P0 数量')

        await browser.close()

    if fail:
        print(f'\n❌ {len(fail)} 失败: {fail}')
    else:
        print('\n✅ V1.6.8 UI 测试通过')

asyncio.run(main())
