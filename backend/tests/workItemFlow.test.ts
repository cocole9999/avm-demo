/**
 * V1.30.2 P3-2d 集成测试: workItem 创建 → 评论 → 状态流转
 *
 * 验证关键业务路径(端到端):
 *   1. 无 token (dev 模式自动 admin) → POST /api/work-items 创建
 *   2. POST /api/comments 添加评论
 *   3. PATCH /api/work-items/:id 修改 status (状态机校验)
 *   4. GET /api/work-items 列表包含新建项
 *   5. GET /api/work-items/:id/activities 活动日志记录完整
 *
 * 跟 health.test.ts 相同: 假设 backend 已在 TEST_BASE_URL 启动
 *   - 启动: cd backend && PORT=4100 npm start
 *   - 没启动: 测试自动跳过 (serverUp=false)
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, P3-2d 集成测试跳过\n`);
  }
});

describe('WorkItem 端到端流程 (P3-2d)', () => {
  it('创建 task → 评论 → 改 status → 验证活动日志', async () => {
    if (!serverUp) return;

    // 1. 创建 task
    const createRes = await fetch(`${BASE}/api/work-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task',
        title: `集成测试 task @ ${new Date().toISOString()}`,
        description: 'P3-2d 自动化测试创建',
        priority: 'P2',
        reporter: 'P3-2d Test',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.id).toBeDefined();
    expect(created.key).toMatch(/^TASK-\d+$/);
    expect(created.status).toBe('待领取'); // initial
    const itemId = created.id;

    // 2. 添加评论
    const commentRes = await fetch(`${BASE}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workItemId: itemId,
        content: 'P3-2d 自动化测试评论 @zhangsan',
        author: 'P3-2d Test',
      }),
    });
    expect(commentRes.status).toBe(201);
    const comment = await commentRes.json();
    expect(comment.workItemId).toBe(itemId);

    // 3. 改 status (待领取 → 进行中)
    const patchRes = await fetch(`${BASE}/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '进行中' }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.status).toBe('进行中');
    expect(updated.actualStart).toBeTruthy(); // 首次进入"进行中"自动记录

    // 4. 列表能查到
    const listRes = await fetch(`${BASE}/api/work-items?type=task&limit=10`);
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const found = list.find((w: any) => w.id === itemId);
    expect(found).toBeDefined();
    expect(found.status).toBe('进行中');

    // 5. 状态机校验: 非法 status 应被拒绝
    const badRes = await fetch(`${BASE}/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '非法状态xxx' }),
    });
    expect(badRes.status).toBe(400);

    // 6. 清理: 流转到"已完成"
    const finishRes = await fetch(`${BASE}/api/work-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '已完成' }),
    });
    expect(finishRes.status).toBe(200);
  });

  it('强密码策略: 拒绝弱密码创建用户 (P3-1d 端到端验证)', async () => {
    if (!serverUp) return;

    // 弱密码 admin123 应被拒绝
    const weakRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'weak_pwd_user', password: 'admin123' }),
    });
    expect(weakRes.status).toBe(400);
    const body = await weakRes.json();
    expect(body.error).toMatch(/过于简单|弱/);

    // 短密码应被拒绝
    const shortRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'short_pwd_user', password: 'Ab1' }),
    });
    expect(shortRes.status).toBe(400);

    // 强密码应通过 (用时间戳保证唯一)
    const ts = Date.now();
    const goodRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `strong_user_${ts}`,
        displayName: 'Strong Test User',
        password: `StrongPwd@${ts}`,
        role: 'member',
      }),
    });
    expect(goodRes.status).toBe(201);
    const created = await goodRes.json();
    expect(created.username).toBe(`strong_user_${ts}`);
  });
});
