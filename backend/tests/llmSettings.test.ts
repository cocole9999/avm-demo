/**
 * LLM 设置路由测试
 * 覆盖: GET/PUT/DELETE /api/llm-settings + 测试 + 切换模型
 * 权限: 写操作需 tenant_admin
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4100';
let serverUp = false;

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = r.status === 200;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, llmSettings 测试跳过\n`);
  }
});

describe('LLM 设置路由', () => {
  it('GET /api/llm-settings 返回 provider 列表 + 设置', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.providers)).toBe(true);
    expect(Array.isArray(body.settings)).toBe(true);
    expect(body.status).toBeDefined();
  });

  it('GET /api/llm-settings/:provider 未配置返回 configured:false', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings/nonexistent`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.configured).toBe(false);
  });

  it('PUT /api/llm-settings/:provider 配置 provider', async () => {
    if (!serverUp) return;
    // 用 deepseek (默认 PROVIDERS 列表中应有)
    const r = await fetch(`${BASE}/api/llm-settings/deepseek`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'sk-test-key-for-integration-test',
        model: 'deepseek-chat',
        temperature: 0.5,
        enabled: true,
      }),
    });
    expect(r.status).toBe(200);
    const cfg = await r.json();
    // apiKey 应脱敏
    expect(cfg.apiKey).toMatch(/\*\*\*/);
    expect(cfg.provider).toBe('deepseek');
  });

  it('PUT /api/llm-settings/:provider temperature 超范围返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings/deepseek`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: 5 }),
    });
    expect(r.status).toBe(400);
  });

  it('PUT /api/llm-settings/:provider maxTokens 非正整数返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings/deepseek`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxTokens: -1 }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/llm-settings/_/status 返回 LLM 状态', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings/_/status`);
    expect(r.status).toBe(200);
    const status = await r.json();
    expect(status).toBeDefined();
  });

  it('GET /api/llm-settings/:provider/models 列出可用模型', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/llm-settings/deepseek/models`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toBeDefined();
  });

  it('POST /api/llm-settings/:provider/primary 标记主 provider', async () => {
    if (!serverUp) return;
    // 先确保 deepseek 已配置
    await fetch(`${BASE}/api/llm-settings/deepseek`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-test-primary', enabled: true }),
    });
    const r = await fetch(`${BASE}/api/llm-settings/deepseek/primary`, { method: 'POST' });
    expect([200, 404]).toContain(r.status);
  });

  it('POST /api/llm-settings/:provider/custom-models 添加自定义模型', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/llm-settings/deepseek/custom-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `custom-model-${ts}` }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.customModels)).toBe(true);
  });

  it('DELETE /api/llm-settings/:provider/custom-models/:model 删除自定义模型', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const model = `del-model-${ts}`;
    await fetch(`${BASE}/api/llm-settings/deepseek/custom-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const r = await fetch(`${BASE}/api/llm-settings/deepseek/custom-models/${model}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(200);
  });

  it('DELETE /api/llm-settings/:provider 删除配置', async () => {
    if (!serverUp) return;
    // 先配置一个临时的
    await fetch(`${BASE}/api/llm-settings/deepseek`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-to-delete' }),
    });
    const r = await fetch(`${BASE}/api/llm-settings/deepseek`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});
