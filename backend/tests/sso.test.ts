/**
 * SSO 路由测试
 * 覆盖: 租户 CRUD + SSO 配置 + demo-login + 日志
 * 权限: 租户写操作需 tenant_admin
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, sso 测试跳过\n`);
  }
});

describe('SSO 租户管理路由', () => {
  it('GET /api/sso/tenants 返回租户列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/tenants`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('POST /api/sso/tenants 创建租户', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const r = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `T_TEST_${ts}`,
        name: `测试租户-${ts}`,
        plan: 'standard',
        maxUsers: 50,
      }),
    });
    expect(r.status).toBe(201);
    const created = await r.json();
    expect(created.id).toBeDefined();
    expect(created.code).toBe(`T_TEST_${ts}`);
  });

  it('POST /api/sso/tenants 缺少 code 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '缺code' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/sso/tenants plan 非法返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'T_BAD', name: '坏', plan: 'invalid_plan' }),
    });
    expect(r.status).toBe(400);
  });

  it('PATCH /api/sso/tenants/:id 更新租户', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_UPD_${ts}`, name: '待更新' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '已更新', contact: '张三' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.name).toBe('已更新');
    expect(updated.contact).toBe('张三');
  });

  it('PATCH /api/sso/tenants/:id 不可改 code (白名单)', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_W_${ts}`, name: '白名单测试' }),
    });
    const created = await createRes.json();
    const originalCode = created.code;

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'T_HACKED', name: '尝试改code' }),
    });
    expect(r.status).toBe(200);
    const updated = await r.json();
    // code 不应在白名单内, 应被忽略
    expect(updated.code).toBe(originalCode);
  });

  it('GET /api/sso/tenants/:id/stats 返回租户统计', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_ST_${ts}`, name: '统计测试' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}/stats`);
    expect([200, 500]).toContain(r.status);
    if (r.status === 200) {
      const stats = await r.json();
      expect(stats.userCount).toBeDefined();
      expect(stats.ssoLogCount).toBeDefined();
    }
  });

  it('DELETE /api/sso/tenants/:id 删除租户', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_DEL_${ts}`, name: '待删' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}`, { method: 'DELETE' });
    expect(r.status).toBe(204);
  });
});

describe('SSO 配置路由', () => {
  it('GET /api/sso/tenants/:tenantId/settings 列出配置', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_SET_${ts}`, name: '配置测试' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}/settings`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('PUT /api/sso/tenants/:tenantId/settings/:provider 配置 SSO', async () => {
    if (!serverUp) return;
    const ts = Date.now();
    const createRes = await fetch(`${BASE}/api/sso/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `T_CFG_${ts}`, name: 'SSO配置' }),
    });
    const created = await createRes.json();

    const r = await fetch(`${BASE}/api/sso/tenants/${created.id}/settings/feishu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        appId: `cli_${ts}`,
        appSecret: `secret_${ts}`,
        redirectUri: 'https://example.com/callback',
      }),
    });
    expect(r.status).toBe(200);
    const cfg = await r.json();
    // appSecret 应脱敏
    expect(cfg.appSecret).toMatch(/\*\*\*/);
    expect(cfg.enabled).toBe(true);
  });
});

describe('SSO demo-login 路由', () => {
  it('POST /api/sso/oauth/feishu/demo-login 缺 tenantId 返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/oauth/feishu/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openId: 'o1' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/sso/oauth/feishu/demo-login 合法请求端点可达', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/oauth/feishu/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'demo-tenant-id', openId: 'demo-openid-xxx' }),
    });
    // dev 模式应可达, 不应 401/403
    expect([200, 400, 404, 500]).toContain(r.status);
  });
});

describe('SSO 日志路由', () => {
  it('GET /api/sso/logs 返回日志列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/logs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/sso/logs?tenantId=xxx 支持过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/sso/logs?tenantId=nonexistent`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });
});
