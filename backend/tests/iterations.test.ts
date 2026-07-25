/**
 * 迭代管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/iterations
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, iterations 测试跳过\n`);
  }
});

describe('迭代管理路由', () => {
  it('GET /api/iterations 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/iterations`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/iterations 创建迭代', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/iterations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试迭代-${Date.now()}`,
        goal: '测试目标',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试迭代/);
  });

  it('PATCH /api/iterations/:id 更新迭代', async () => {
    if (!serverUp) return;
    // 先创建一个 (name 带 timestamp 避免 unique 冲突)
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/iterations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `待更新迭代-${ts}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const created = await createRes.json();

    // 更新 (name 仍带 timestamp 避免与其它测试残留冲突)
    const r = await fetch(`${BASE}/api/iterations/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `已更新迭代-${ts}`, status: 'active' }),
      signal: AbortSignal.timeout(25000),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe(`已更新迭代-${ts}`);
  }, 30000);

  it('DELETE /api/iterations/:id 删除迭代', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/iterations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `待删除迭代-${Date.now()}`,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/iterations/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(204);
  });
});
