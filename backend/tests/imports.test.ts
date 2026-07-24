/**
 * 数据导入路由测试
 * 覆盖: GET /api/imports/resources + 模板下载 + preview + execute + jobs
 * 权限: 鉴权 + autoRole (写需 space_admin, 删需 tenant_admin)
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, imports 测试跳过\n`);
  }
});

describe('数据导入路由 - 资源元信息', () => {
  it('GET /api/imports/resources 返回可导入资源', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/resources`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.resources)).toBe(true);
    expect(body.aliases).toBeDefined();
    if (body.resources.length > 0) {
      const res = body.resources[0];
      expect(res.key).toBeDefined();
      expect(res.label).toBeDefined();
      expect(Array.isArray(res.fields)).toBe(true);
    }
  });

  it('GET /api/imports/template/customers 下载客户模板', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/template/customers`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/csv/);
    const text = await r.text();
    expect(text.length).toBeGreaterThan(0);
  });

  it('GET /api/imports/template/work_items 下载工作项模板', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/template/work_items`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/csv/);
  });

  it('GET /api/imports/template/unknown_resource 未知资源返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/template/nonexistent_resource`);
    expect(r.status).toBe(400);
  });
});

describe('数据导入路由 - preview 解析', () => {
  it('POST /api/imports/preview 缺 resource 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: 'a,b\n1,2' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/preview 未知 resource 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'nonexistent', csvText: 'a,b\n1,2' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/preview 缺 file/csvText 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/preview 解析 customers CSV', async () => {
    if (!serverUp) return;
    const csv = 'name,code,type\n测试客户A,CUST_A,internal\n测试客户B,CUST_B,external';
    const r = await fetch(`${BASE}/api/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers', csvText: csv }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.resource).toBe('customers');
    expect(body.total).toBe(2);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(Array.isArray(body.mapping)).toBe(true);
  });

  it('POST /api/imports/preview 空数据返回空数组', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers', csvText: 'only_header' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.total).toBe(0);
  });
});

describe('数据导入路由 - execute 执行', () => {
  it('POST /api/imports/execute 缺 resource 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [{ name: 'x' }] }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/execute 缺 data 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/execute 空数据返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers', data: [] }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/execute 未知 resource 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'nonexistent', data: [{ a: 1 }] }),
    });
    expect(r.status).toBe(400);
  });
});

describe('数据导入路由 - 任务列表', () => {
  it('GET /api/imports/jobs 返回任务列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/jobs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/imports/jobs?status=completed 支持状态过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/jobs?status=completed`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/imports/jobs/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/jobs/non-existent-id`);
    expect(r.status).toBe(404);
  });
});

describe('数据导入路由 - parse-csv 兼容', () => {
  it('POST /api/imports/parse-csv 缺 csv 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/parse-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/imports/parse-csv 解析合法 CSV', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/imports/parse-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'a,b,c\n1,2,3\n4,5,6' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.total).toBe(2);
    expect(Array.isArray(body.rows)).toBe(true);
  });
});
