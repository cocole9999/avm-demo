/**
 * 评论管理路由测试
 * 覆盖: GET/POST/DELETE /api/comments
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, comments 测试跳过\n`);
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

describe('评论管理路由', () => {
  it('GET /api/comments?workItemId=... 返回列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/comments?workItemId=${testWorkItemId}`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/comments 添加评论', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: testWorkItemId,
        content: '测试评论内容',
        author: '测试用户',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.content).toBe('测试评论内容');
  });

  it('POST /api/comments/:id/react 添加表情反应', async () => {
    if (!serverUp) return;
    // 先创建一条评论
    const createRes = await fetch(`${BASE}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: testWorkItemId,
        content: '待反应评论',
        author: '测试用户',
      }),
    });
    const created = await createRes.json();

    // 添加反应
    const r = await fetch(`${BASE}/api/comments/${created.id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍', user: '测试用户' }),
    });
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result.ok).toBe(true);
    expect(result.action).toBe('added');
  });

  it('DELETE /api/comments/:id 删除评论', async () => {
    if (!serverUp) return;
    // 先创建一条评论
    const createRes = await fetch(`${BASE}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: testWorkItemId,
        content: '待删除评论',
        author: '测试用户',
      }),
    });
    const created = await createRes.json();

    // 删除
    const r = await fetch(`${BASE}/api/comments/${created.id}`, {
      method: 'DELETE',
    });
    expect(r.status).toBe(204);
  });
});
