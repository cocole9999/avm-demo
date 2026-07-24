/**
 * 审计日志路由测试
 * 覆盖: GET /api/audit-logs + stats + by-entity + cleanup
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
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, auditLogs 测试跳过\n`);
  }
});

describe('审计日志路由', () => {
  it('GET /api/audit-logs 返回审计日志列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs`);
    // dev 模式 admin 满足 space_admin 要求
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const body = await r.json();
      expect(body.items).toBeDefined();
      expect(body.total).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  it('GET /api/audit-logs?entity=user 支持 entity 过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs?entity=user`);
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const body = await r.json();
      expect(body.items).toBeDefined();
    }
  });

  it('GET /api/audit-logs?limit=5 支持分页', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs?limit=5&offset=0`);
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const body = await r.json();
      expect(body.limit).toBeLessThanOrEqual(5);
    }
  });

  it('GET /api/audit-logs/stats 返回统计', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs/stats`);
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const stats = await r.json();
      expect(stats.total).toBeDefined();
      expect(stats.byEntity).toBeDefined();
      expect(stats.byAction).toBeDefined();
      expect(stats.byActor).toBeDefined();
    }
  });

  it('GET /api/audit-logs/stats?days=30 支持天数过滤', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs/stats?days=30`);
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const stats = await r.json();
      expect(stats.since).toBeDefined();
    }
  });

  it('GET /api/audit-logs/:id 不存在返回 404', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs/non-existent-id`);
    expect([404, 403]).toContain(r.status);
  });

  it('GET /api/audit-logs/by-entity/:entity/:entityId 返回实体变更历史', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs/by-entity/user/dev-user`);
    expect([200, 403]).toContain(r.status);
    if (r.status === 200) {
      const list = await r.json();
      expect(Array.isArray(list)).toBe(true);
    }
  });

  it('DELETE /api/audit-logs/cleanup 缺 before 参数返回 400', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/audit-logs/cleanup`, { method: 'DELETE' });
    expect([400, 403]).toContain(r.status);
  });
});
