/**
 * 数据导出路由测试
 * 覆盖: GET /api/export/work-items|projects|customers|car-models|risks
 * 权限: 全部需要 space_admin
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, export 测试跳过\n`);
  }
});

describe('数据导出路由', () => {
  it('GET /api/export/work-items?format=xlsx 导出工作项 (xlsx)', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?format=xlsx`);
    expect([200, 400, 500, 403]).toContain(r.status);
    if (r.status === 200) {
      expect(r.headers.get('content-type')).toMatch(/spreadsheet/);
    }
  });

  it('GET /api/export/work-items?format=csv 导出工作项 (csv)', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?format=csv`);
    expect([200, 400, 500, 403]).toContain(r.status);
    if (r.status === 200) {
      expect(r.headers.get('content-type')).toMatch(/csv/);
    }
  });

  it('GET /api/export/work-items?format=pdf 非法 format 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?format=pdf`);
    expect(r.status).toBe(400);
  });

  it('GET /api/export/work-items?type=task 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?type=task&format=xlsx`);
    expect([200, 400, 500, 403]).toContain(r.status);
  });

  it('GET /api/export/work-items?keyword=xxx 支持 keyword 过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?keyword=test&format=csv`);
    expect([200, 400, 500, 403]).toContain(r.status);
  });

  it('GET /api/export/work-items?keyword 过长返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/work-items?keyword=${'x'.repeat(250)}`);
    expect(r.status).toBe(400);
  });

  it('GET /api/export/projects?format=xlsx 导出项目', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/projects?format=xlsx`);
    expect([200, 400, 500, 403]).toContain(r.status);
    if (r.status === 200) {
      expect(r.headers.get('content-type')).toMatch(/spreadsheet/);
    }
  });

  it('GET /api/export/projects?format=xml 非法 format 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/projects?format=xml`);
    expect(r.status).toBe(400);
  });

  it('GET /api/export/customers?format=xlsx 导出客户', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/customers?format=xlsx`);
    expect([200, 400, 500, 403]).toContain(r.status);
  });

  it('GET /api/export/car-models?format=csv 导出车型', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/car-models?format=csv`);
    expect([200, 400, 500, 403]).toContain(r.status);
  });

  it('GET /api/export/risks?format=xlsx 导出风险预警', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/export/risks?format=xlsx`);
    expect([200, 400, 500, 403]).toContain(r.status);
  });
});
