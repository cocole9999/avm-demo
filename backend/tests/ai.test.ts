/**
 * AI 功能路由测试
 * 覆盖: POST /api/ai/suggest-estimate, /api/ai/classify-bug, /api/ai/qa
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4000';
let serverUp = false;

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = r.status === 200;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.warn(`\n⚠️  后端未在 ${BASE} 运行, ai 测试跳过\n`);
  }
});

describe('AI 功能路由', () => {
  it('GET /api/ai/configs 返回配置列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/configs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/ai/logs 返回日志列表', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/logs`);
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
  });

  it('GET /api/ai/llm-status 返回 LLM 状态', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/llm-status`);
    expect(r.status).toBe(200);
    const status = await r.json();
    expect(status).toBeDefined();
  });

  it('POST /api/ai/suggest-estimate 估分建议', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/suggest-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '测试任务',
        description: '测试描述',
        type: 'task',
      }),
    });
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result).toBeDefined();
  });

  it('POST /api/ai/classify-bug 缺陷归类', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/classify-bug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '测试缺陷',
        description: '测试描述',
      }),
    });
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result).toBeDefined();
  });

  it('POST /api/ai/qa 智能问答', async () => {
    if (!serverUp) return;
    const r = await fetch(`${BASE}/api/ai/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: '什么是 AVM 项目中心？',
      }),
    });
    expect(r.status).toBe(200);
    const result = await r.json();
    expect(result).toBeDefined();
  });
});
