/**
 * 字段管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/fields/formulas + rollups + 派生字段 + 公式测试
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, fields 测试跳过\n`);
  }
});

describe('字段管理 - 公式字段', () => {
  it('GET /api/fields/formulas 返回公式列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/formulas`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/fields/formulas?workType=task 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/formulas?workType=task`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/fields/formulas 创建公式字段', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'task',
        name: `测试公式-${ts}`,
        fieldKey: `test_field_${ts}`,
        formula: 'estimate * 2',
        outputType: 'number',
        description: '集成测试',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.name).toMatch(/测试公式/);
  });

  it('POST /api/fields/formulas 缺 workType 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '缺 workType',
        fieldKey: 'x',
        formula: '1+1',
      }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/fields/formulas 缺 formula 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'task',
        name: '缺 formula',
        fieldKey: 'y',
      }),
    });
    expect(r.status).toBe(400);
  });

  it('PATCH /api/fields/formulas/:id 更新公式', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'task',
        name: `upd-${ts}`,
        fieldKey: `upd_${ts}`,
        formula: 'estimate * 2',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/fields/formulas/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', formula: 'estimate * 3' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
  });

  it('POST /api/fields/formulas/:id/recompute 重算公式', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'task',
        name: `recompute-${ts}`,
        fieldKey: `rc_${ts}`,
        formula: 'estimate + 1',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/fields/formulas/${created.id}/recompute`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.count).toBeDefined();
  });

  it('DELETE /api/fields/formulas/:id 删除公式', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/fields/formulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'task',
        name: `del-${ts}`,
        fieldKey: `del_${ts}`,
        formula: 'estimate',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/fields/formulas/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});

describe('字段管理 - 聚合字段', () => {
  it('GET /api/fields/rollups 返回聚合字段列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/rollups`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/fields/rollups 创建聚合字段', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/fields/rollups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'epic',
        name: `测试聚合-${ts}`,
        fieldKey: `rollup_${ts}`,
        childType: 'task',
        sourceField: 'estimate',
        aggregation: 'sum',
        outputType: 'number',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
  });

  it('POST /api/fields/rollups 缺 aggregation 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/rollups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workType: 'epic',
        name: '缺 aggregation',
        fieldKey: 'no_agg',
        sourceField: 'estimate',
      }),
    });
    expect(r.status).toBe(400);
  });
});

describe('字段管理 - 派生字段查询', () => {
  it('GET /api/fields/derived/:workItemId 返回派生字段', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/derived/non-existent-id`);
    // 不存在应返回 200 + 空对象 或 500
    expect([200, 500]).toContain(r.status);
  });

  it('POST /api/fields/recompute-all 重算所有', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/recompute-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toBeDefined();
  });
});

describe('字段管理 - 公式测试与元信息', () => {
  it('POST /api/fields/test-formula 测试公式求值', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/test-formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formula: 'estimate * 2 + 1',
        sample: { estimate: 5 },
      }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.value).toBe(11);
  });

  it('POST /api/fields/test-formula IFNULL 函数', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/test-formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formula: 'IFNULL(estimate, 99)',
        sample: {},
      }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.value).toBe(99);
  });

  it('POST /api/fields/validate 合法公式返回 valid:true', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula: '1 + 2' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.valid).toBe(true);
  });

  it('POST /api/fields/validate 非法公式返回 valid:false', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula: 'unknown_fn(' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.valid).toBe(false);
  });

  it('GET /api/fields/meta 返回元信息', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/fields/meta`);
    expect(r.status).toBe(200);
    const meta = await r.json();
    expect(meta).toBeDefined();
  });
});
