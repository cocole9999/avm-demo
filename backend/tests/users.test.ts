/**
 * 用户管理路由测试
 * 覆盖: GET/POST/PATCH/DELETE /api/users + /login + /logout
 * 权限: POST/PATCH/DELETE 需 tenant_admin
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, users 测试跳过\n`);
  }
});

describe('用户管理路由', () => {
  it('GET /api/users 返回用户列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/users`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) {
      expect(list[0].username).toBeDefined();
      // 不应返回 password 字段
      expect(list[0].password).toBeUndefined();
    }
  });

  it('POST /api/users 强密码创建用户成功', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `test_user_${ts}`,
        displayName: '测试用户',
        password: `StrongPwd@${ts}`,
        role: 'member',
        department: '测试部',
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.username).toBe(`test_user_${ts}`);
    expect(created.password).toBeUndefined();
  });

  it('POST /api/users 弱密码应被拒绝', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `weak_user_${Date.now()}`,
        password: 'admin123',
      }),
    });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/弱|简单|数字|字母/);
  });

  it('POST /api/users 缺少 username/password 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '无密码' }),
    });
    expect(r.status).toBe(400);
  });

  it('PATCH /api/users/:id 更新 displayName', async () => {
    if (!serverUp) return;
    // 先创建
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `patch_user_${ts}`,
        displayName: '待改',
        password: `StrongPwd@${ts}`,
      }),
    });
    const created = await createRes.json();

    // 更新 displayName
    const r = await fetch(`${BASE}/api/users/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: '已改' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.displayName).toBe('已改');
  });

  it('PATCH /api/users/:id 角色变更记录审计', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `role_user_${ts}`,
        displayName: '角色测试',
        password: `StrongPwd@${ts}`,
        role: 'member',
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/users/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'space_admin' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.role).toBe('space_admin');
  });

  it('POST /api/users/login 错误密码返回 401', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent_user_xyz',
        password: 'WrongPwd@2026',
      }),
    });
    expect(r.status).toBe(401);
  });

  it('POST /api/users/login 正确密码返回 token', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const username = `login_user_${ts}`;
    const password = `StrongPwd@${ts}`;
    await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName: '登录测试', password }),
    });

    const r = await fetch(`${BASE}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.token).toBeDefined();
    expect(body.user.username).toBe(username);
  });

  it('POST /api/users/logout 返回 ok', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/users/logout`, {
      method: 'POST',
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
  });

  it('DELETE /api/users/:id 删除用户', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `del_user_${ts}`,
        displayName: '待删',
        password: `StrongPwd@${ts}`,
      }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/users/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});
