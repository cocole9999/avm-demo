/**
 * 车型管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/car-models
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, carModels 测试跳过\n`);
  }
});

describe('车型管理路由', () => {
  it('GET /api/car-models 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/car-models`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/car-models?brand=吉利 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/car-models?brand=吉利`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/car-models 创建车型', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/car-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '测试车型',
        brand: '吉利',
        series: '银河',
        status: 'active',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toBe('测试车型');
  });

  it('PATCH /api/car-models/:id 更新车型', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/car-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待更新车型',
        brand: '吉利',
      }),
    });
    const created = await createRes.json();

    // 更新
    const r = await fetch(`${BASE}/api/car-models/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新车型' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新车型');
  });

  it('DELETE /api/car-models/:id 删除车型', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/car-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待删除车型',
        brand: '吉利',
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/car-models/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(200);
  });

  it('GET /api/car-models/_stats/by-brand 返回统计', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/car-models/_stats/by-brand`);
    expect(r.status).toBe(200);
    const stats = await r.json();
    expect(stats.total).toBeDefined();
    expect(stats.byBrand).toBeDefined();
  });
});
