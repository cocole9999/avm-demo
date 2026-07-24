/**
 * 空间管理路由测试
 * 覆盖: GET/POST/PATCH /api/spaces + 成员管理
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, spaces 测试跳过\n`);
  }
});

describe('空间管理路由', () => {
  it('GET /api/spaces 返回空间列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/spaces`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/spaces 创建空间', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试空间-${ts}`,
        code: `test-space-${ts}`,
        description: '集成测试创建',
        icon: 'project',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试空间/);
  });

  it('GET /api/spaces/:id 返回空间详情', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `详情空间-${ts}`, code: `detail-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/spaces/${created.id}`);
    expect(r.status).toBe(200);
    const detail = await r.json();
    expect(detail.id).toBe(created.id);
    expect(detail._count).toBeDefined();
  });

  it('GET /api/spaces/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/spaces/non-existent-id`);
    expect(r.status).toBe(404);
  });

  it('PATCH /api/spaces/:id 更新空间', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `待更新-${ts}`, code: `upd-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/spaces/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', description: '更新后描述' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
    expect(updated.description).toBe('更新后描述');
  });

  it('GET /api/spaces/:id/members 返回成员列表', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `成员空间-${ts}`, code: `mb-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/spaces/${created.id}/members`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/spaces/:id/members 添加成员', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `加成员空间-${ts}`, code: `add-mb-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/spaces/${created.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-id',
        userName: `测试成员-${ts}`,
        role: 'member',
      }),
    });
    expect(r.status).toBe(201);
    const m = await r.json();
    expect(m.userName).toMatch(/测试成员/);
    expect(m.role).toBe('member');
  });

  it('GET /api/spaces/me/:userId 返回用户空间', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/spaces/me/dev-user`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
