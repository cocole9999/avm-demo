/**
 * 评审管理路由测试
 * 覆盖: GET/POST /api/reviews
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000';
let serverUp = false;
let testWorkItemId: string;

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = r.status === 200;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, reviews 测试跳过\n`);
    return;
  }

  // 创建一个测试工作项
  const createRes = await fetch(`${BASE}/api/work-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'task',
      title: `测试工作项-${Date.now()}`,
      reporter: '测试用户',
    }),
  });
  const created = await createRes.json();
  testWorkItemId = created.id;
});

describe('评审管理路由', () => {
  it('GET /api/reviews 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/reviews`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/reviews 创建评审', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: testWorkItemId,
        reviewType: 'code_review',
        title: `测试评审-${Date.now()}`,
        initiator: '测试用户',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.title).toMatch(/测试评审/);
  });

  it('GET /api/reviews/templates/all 返回模板列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/reviews/templates/all`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
