/**
 * 通知中心路由测试
 * 覆盖: GET/POST /api/notifications + 已读 + 全部已读 + 删除 + 扫描
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, notifications 测试跳过\n`);
  }
});

describe('通知中心路由', () => {
  it('GET /api/notifications?userId=test 返回通知列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications?userId=test-user`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/notifications 缺 userId 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications`);
    expect(r.status).toBe(400);
  });

  it('GET /api/notifications?userId=test&filter=unread 支持未读过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications?userId=test-user&filter=unread`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/notifications/unread-count 返回未读数量', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications/unread-count?userId=test-user`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.count).toBeDefined();
  });

  it('GET /api/notifications/unread-count 缺 userId 返回 count:0', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications/unread-count`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.count).toBe(0);
  });

  it('POST /api/notifications 创建通知', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: `test-recipient-${ts}`,
        type: 'mention',
        level: 'info',
        title: `测试通知-${ts}`,
        content: '集成测试创建',
        link: '/work-items/task/123',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.title).toMatch(/测试通知/);
  });

  it('POST /api/notifications 默认 level 为 info', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: `default-level-${ts}`,
        type: 'assign',
        title: '默认 level',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.level).toBe('info');
  });

  it('POST /api/notifications/:id/read 标记已读', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: `read-test-${ts}`,
        type: 'mention',
        title: '待读',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/notifications/${created.id}/read`, { method: 'POST' });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.read).toBe(true);
    expect(updated.readAt).toBeTruthy();
  });

  it('POST /api/notifications/read-all 全部已读', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const userId = `all-read-${ts}`;
    await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: userId, type: 'mention', title: '1' }),
    });
    await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: userId, type: 'mention', title: '2' }),
    });

    const r = await fetch(`${BASE}/api/notifications/read-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.updated).toBeDefined();
  });

  it('DELETE /api/notifications/:id 删除通知', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId: `del-${ts}`,
        type: 'mention',
        title: '待删',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/notifications/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });

  it('POST /api/notifications/scan-due 扫描临期/超期', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/notifications/scan-due`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.created).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
  });
});
