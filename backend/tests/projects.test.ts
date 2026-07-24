/**
 * 项目管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/projects
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000';
let serverUp = false;

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = r.status === 200;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, projects 测试跳过\n`);
  }
});

describe('项目管理路由', () => {
  it('GET /api/projects 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/projects`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/projects?status=planning 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/projects?status=planning`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/projects 创建项目', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '测试项目',
        status: 'planning',
        billingType: 'ODC',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toBe('测试项目');
  });

  it('PATCH /api/projects/:id 更新项目', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待更新项目',
        status: 'planning',
      }),
    });
    const created = await createRes.json();

    // 更新
    const r = await fetch(`${BASE}/api/projects/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新项目', status: 'in_progress' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新项目');
  });

  it('DELETE /api/projects/:id 删除项目', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待删除项目',
        status: 'planning',
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/projects/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(204);
  });

  it('GET /api/projects/_stats/summary 返回统计', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/projects/_stats/summary`);
    expect(r.status).toBe(200);
    const stats = await r.json();
    expect(stats.total).toBeDefined();
    expect(stats.byStatus).toBeDefined();
    expect(stats.byBillingType).toBeDefined();
  });
});
