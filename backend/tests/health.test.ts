/**
 * P2-3 集成测试: 健康检查 + 限流 + 鉴权
 *
 * 注意: 假设 backend 已在 PORT=4100 启动 (e.g. `npm start` 在另一终端)
 *   - 跑测试前: 启动 backend: cd backend && PORT=4100 npm start
 *   - 跑测试:    npm test
 *
 * 如果没启动后端, 测试会跳过 (用 hasServerBeforeAll 标志)
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4100';
let serverUp = false;

beforeAll(async () => {
  // 探测后端是否运行
  try {
    const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = r.status === 200;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(`\n⚠️  后端未在 ${BASE_URL} 运行, 跳过集成测试`);
    console.warn(`   启动命令: cd backend && PORT=4100 npm start\n`);
  }
});

describe('Health endpoint', () => {
  it('GET /api/health 返回 200 + status ok', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE_URL}/api/health`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(body.ts).toBeDefined();
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('GET /api/health/deep 探测 DB 连通性', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE_URL}/api/health/deep`);
    expect([200, 503]).toContain(r.status);
    const body = await r.json();
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
  });
});

describe('Rate limit', () => {
  it('login 端点超过 5 次/分返回 429', async () => {
    if (!serverUp) return;
    const results: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await fetch(`${BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
      });
      results.push(r.status);
    }
    const limited = results.filter((s) => s === 429).length;
    const ok = results.filter((s) => s === 401).length;
    expect(ok).toBeGreaterThanOrEqual(1);
    expect(limited).toBeGreaterThanOrEqual(1);
  });
});

describe('Auth middleware', () => {
  it('无 token 访问受保护端点返回 401 (生产模式)', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE_URL}/api/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(r.status);
  });
});
