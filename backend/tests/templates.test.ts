/**
 * 工作项模板路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/templates
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, templates 测试跳过\n`);
  }
});

describe('工作项模板路由', () => {
  it('GET /api/templates 返回模板列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/templates`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/templates?workType=task 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/templates?workType=task`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/templates 创建模板', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试模板-${ts}`,
        workType: 'task',
        description: '集成测试创建',
        defaultFields: { priority: 'P2', module: 'M1' },
        childItems: [],
        category: '通用',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试模板/);
    expect(created.workType).toBe('task');
  });

  it('POST /api/templates 缺 name 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workType: 'task' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/templates 缺 workType 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '缺 workType' }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/templates/:id 返回详情', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `详情-${ts}`, workType: 'bug' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/templates/${created.id}`);
    expect(r.status).toBe(200);
    const detail = await r.json();
    expect(detail.id).toBe(created.id);
  });

  it('GET /api/templates/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/templates/non-existent-id`);
    expect(r.status).toBe(404);
  });

  it('PATCH /api/templates/:id 更新模板', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `待更新-${ts}`, workType: 'task' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/templates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', description: '改了描述' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
  });

  it('DELETE /api/templates/:id 删除模板', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `待删-${ts}`, workType: 'task' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/templates/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});
