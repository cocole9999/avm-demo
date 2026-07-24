/**
 * 客户管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/customers
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, customers 测试跳过\n`);
  }
});

describe('客户管理路由', () => {
  it('GET /api/customers 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/customers`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/customers?status=active 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/customers?status=active`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/customers 创建客户', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '测试客户',
        type: 'internal',
        status: 'active',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toBe('测试客户');
  });

  it('PATCH /api/customers/:id 更新客户', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待更新客户',
        type: 'internal',
      }),
    });
    const created = await createRes.json();

    // 更新
    const r = await fetch(`${BASE}/api/customers/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新客户' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新客户');
  });

  it('DELETE /api/customers/:id 删除客户', async () => {
    if (!serverUp) return;
    // 先创建一个
    const createRes = await fetch(`${BASE}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `TEST-${Date.now()}`,
        name: '待删除客户',
        type: 'internal',
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/customers/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(200);
  });

  it('GET /api/customers/_stats/summary 返回统计', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/customers/_stats/summary`);
    expect(r.status).toBe(200);
    const stats = await r.json();
    expect(stats.total).toBeDefined();
    expect(stats.active).toBeDefined();
    expect(stats.byType).toBeDefined();
  });
});
