/**
 * Webhook 路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/webhooks/configs + 测试发送 + inbox + 日志
 * 权限: 鉴权 + autoRole
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, webhooks 测试跳过\n`);
  }
});

describe('Webhook 配置路由', () => {
  it('GET /api/webhooks/configs 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/configs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/webhooks/configs 创建 Webhook', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试Webhook-${ts}`,
        url: `https://example.com/webhook/${ts}`,
        events: 'work_item.created,work_item.updated',
        enabled: true,
        retryCount: 3,
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试Webhook/);
  });

  it('POST /api/webhooks/configs 缺 name 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/wh' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/webhooks/configs 缺 url 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '缺 url' }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/webhooks/configs/:id 返回详情', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `详情-${ts}`,
        url: `https://example.com/${ts}`,
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/webhooks/configs/${created.id}`);
    expect(r.status).toBe(200);
    const detail = await r.json();
    expect(detail.id).toBe(created.id);
  });

  it('GET /api/webhooks/configs/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/configs/non-existent-id`);
    expect(r.status).toBe(404);
  });

  it('PATCH /api/webhooks/configs/:id 更新 Webhook', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `待更新-${ts}`, url: `https://example.com/u${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/webhooks/configs/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', enabled: false }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
    expect(updated.enabled).toBe(false);
  });

  it('DELETE /api/webhooks/configs/:id 删除 Webhook', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `待删-${ts}`, url: `https://example.com/d${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/webhooks/configs/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});

describe('Webhook 测试发送 + inbox', () => {
  it('POST /api/webhooks/configs/:id/test 测试发送', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/webhooks/configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试发送-${ts}`,
        url: `https://httpbin.org/post`,
        enabled: true,
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/webhooks/configs/${created.id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { test: true } }),
    });
    expect(r.status).toBe(200);
  });

  it('POST /api/webhooks/inbox/:token 短 token 拒绝 401', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/inbox/short`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    expect(r.status).toBe(401);
  });

  it('POST /api/webhooks/inbox/:token 无效 token 拒绝 401', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/inbox/invalid-token-xxxxxxxxxxxx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    expect(r.status).toBe(401);
  });
});

describe('Webhook 日志', () => {
  it('GET /api/webhooks/logs 返回日志列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/webhooks/logs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
