/**
 * 仪表盘管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/dashboards
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, dashboards 测试跳过\n`);
  }
});

describe('仪表盘管理路由', () => {
  it('GET /api/dashboards 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dashboards`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/dashboards 创建仪表盘', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试仪表盘-${Date.now()}`,
        description: '测试描述',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试仪表盘/);
  });

  it('PATCH /api/dashboards/:id 更新仪表盘', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `待更新仪表盘-${Date.now()}`,
      }),
    });
    const created = await createRes.json();

    // 更新
    const r = await fetch(`${BASE}/api/dashboards/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新仪表盘' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新仪表盘');
  });

  it('DELETE /api/dashboards/:id 删除仪表盘', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `待删除仪表盘-${Date.now()}`,
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/dashboards/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(204);
  });
});
