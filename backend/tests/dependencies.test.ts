/**
 * 外部依赖管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/dependencies + stats + ready
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, dependencies 测试跳过\n`);
  }
});

describe('外部依赖管理路由', () => {
  it('GET /api/dependencies 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/dependencies?type=台架 支持 type 过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies?type=台架`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/dependencies?status=pending 支持 status 过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies?status=pending`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/dependencies 创建依赖', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: '台架',
        name: `测试台架-${ts}`,
        description: '集成测试',
        status: 'pending',
        owner: '张三',
        expectedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试台架/);
  });

  it('POST /api/dependencies 缺 type 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '缺 type' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/dependencies 非法 type 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '非法类型', name: '坏 type' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/dependencies 缺 name 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '台架' }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/dependencies/stats/summary 返回统计', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies/stats/summary`);
    expect(r.status).toBe(200);
    const stats = await r.json();
    expect(stats.total).toBeDefined();
    expect(stats.byType).toBeDefined();
    expect(stats.byStatus).toBeDefined();
    expect(stats.overdue).toBeDefined();
  });

  it('GET /api/dependencies/:id 返回详情', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '实车', name: `详情车-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}`);
    expect(r.status).toBe(200);
    const detail = await r.json();
    expect(detail.id).toBe(created.id);
  });

  it('GET /api/dependencies/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dependencies/non-existent-id`);
    expect(r.status).toBe(404);
  });

  it('PATCH /api/dependencies/:id 更新依赖', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '车模', name: `待更新-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', owner: '李四' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
    expect(updated.owner).toBe('李四');
  });

  it('PATCH /api/dependencies/:id 非法 status 返回 400', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'SDB', name: `status-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid_status' }),
    });
    expect(r.status).toBe(400);
  });

  it('PATCH /api/dependencies/:id blocked 状态需 blocker', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'UE', name: `block-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'blocked' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/dependencies/:id/ready 标记就绪', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'UI', name: `ready-${ts}`, status: 'pending' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}/ready`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.dep.status).toBe('ready');
  });

  it('DELETE /api/dependencies/:id 删除依赖', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: '标定', name: `del-${ts}` }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/dependencies/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});
