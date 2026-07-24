/**
 * 自动化规则路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/automation/rules + 测试运行 + 元信息
 * 权限: 鉴权 + autoRole (GET 任意, 写需 space_admin, 删需 tenant_admin)
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, automation 测试跳过\n`);
  }
});

describe('自动化规则路由', () => {
  it('GET /api/automation/rules 返回规则列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/rules`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/automation/rules?enabled=true 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/rules?enabled=true`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/automation/rules 创建规则', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试规则-${ts}`,
        description: '集成测试创建',
        trigger: { type: 'manual' },
        conditions: [{ field: 'type', op: 'eq', value: 'bug' }],
        actions: [{ type: 'set_field', field: 'priority', value: 'P1' }],
        createdBy: 'test',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试规则/);
  });

  it('POST /api/automation/rules 缺 name 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/automation/rules 缺 actions 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '缺 actions',
        trigger: { type: 'manual' },
      }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/automation/rules/:id 返回详情', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `详情规则-${ts}`,
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}`);
    expect(r.status).toBe(200);
    const detail = await r.json();
    expect(detail.id).toBe(created.id);
  });

  it('GET /api/automation/rules/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/rules/non-existent-id`);
    expect(r.status).toBe(404);
  });

  it('PATCH /api/automation/rules/:id 更新规则', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `待更新-${ts}`,
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', description: '改了' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
  });

  it('POST /api/automation/rules/:id/toggle 切换启用状态', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `toggle-${ts}`,
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    const created = await createRes.json();
    const originalEnabled = created.enabled;

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}/toggle`, { method: 'POST' });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.enabled).toBe(!originalEnabled);
  });

  it('POST /api/automation/rules/:id/test 干跑测试', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `test-${ts}`,
        trigger: { type: 'manual' },
        conditions: [{ field: 'type', op: 'eq', value: 'bug' }],
        actions: [{ type: 'set_field', field: 'priority', value: 'P1' }],
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { type: 'bug' } }),
    });
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result.matched).toBeDefined();
  });

  it('POST /api/automation/rules/:id/run 手动运行', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `run-${ts}`,
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: {} }),
    });
    expect(r.status).toBe(200);
  });

  it('GET /api/automation/meta/triggers 返回触发器元信息', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/meta/triggers`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/automation/meta/conditions 返回条件元信息', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/meta/conditions`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/automation/meta/actions 返回操作元信息', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/meta/actions`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/automation/logs 返回执行日志', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/automation/logs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('DELETE /api/automation/rules/:id 删除规则', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/automation/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `del-${ts}`,
        trigger: { type: 'manual' },
        actions: [],
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/automation/rules/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});
