/**
 * 告警引擎测试 (V1.30.3 P2-9)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../db', () => ({
  prisma: {
    webhookConfig: { findMany: vi.fn().mockResolvedValue([]) },
    webhookLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { sendAlert, _clearDedupe, alertOnHealthFail } from './alertEngine';

describe('services/alertEngine', () => {
  beforeEach(() => {
    _clearDedupe();
    vi.clearAllMocks();
  });

  describe('sendAlert 去重', () => {
    it('同 type+title 在 5 分钟内只发一次', async () => {
      const r1 = await sendAlert({
        type: 'test_alert',
        severity: 'info',
        title: '重复告警',
        message: 'first',
      });
      const r2 = await sendAlert({
        type: 'test_alert',
        severity: 'info',
        title: '重复告警',
        message: 'second',
      });
      expect(r1.sent).toBe(true);
      expect(r2.sent).toBe(false);
      expect(r2.reason).toBe('deduped');
    });

    it('不同 title 不会被去重', async () => {
      const r1 = await sendAlert({ type: 't', severity: 'info', title: 'a', message: '' });
      const r2 = await sendAlert({ type: 't', severity: 'info', title: 'b', message: '' });
      expect(r1.sent).toBe(true);
      expect(r2.sent).toBe(true);
    });

    it('不同 type 不会被去重', async () => {
      const r1 = await sendAlert({ type: 't1', severity: 'info', title: 'same', message: '' });
      const r2 = await sendAlert({ type: 't2', severity: 'info', title: 'same', message: '' });
      expect(r1.sent).toBe(true);
      expect(r2.sent).toBe(true);
    });
  });

  describe('sendAlert 通道选择', () => {
    it('未配置任何 webhook 时无操作', async () => {
      const r = await sendAlert({
        type: 'no_target', severity: 'info', title: 'x', message: 'y',
      });
      expect(r.sent).toBe(true);
      expect(r.results).toEqual([]);
    });

    it('指定 channels=["webhook"] 时仅走 webhook', async () => {
      // 模拟通用 webhook
      const { prisma } = await import('../db');
      (prisma.webhookConfig.findMany as any).mockResolvedValueOnce([
        { id: 'w1', name: 'test', url: 'https://example.com/hook', enabled: true, events: '', headers: '{}' },
      ]);
      // 拦截 fetch
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('') });
      try {
        const r = await sendAlert({
          type: 't1', severity: 'info', title: 'x', message: 'y',
        }, ['webhook']);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(r.results.find(x => x.channel === 'webhook')?.status).toBe('success');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('飞书 URL 自动走飞书通道并生成 interactive card', async () => {
      const { prisma } = await import('../db');
      (prisma.webhookConfig.findMany as any).mockResolvedValueOnce([
        { id: 'f1', name: '飞书群', url: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx', enabled: true, events: '', headers: '{}' },
      ]);
      const originalFetch = global.fetch;
      let capturedBody = '';
      global.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
        capturedBody = opts.body;
        return { ok: true, status: 200, text: () => Promise.resolve('') };
      });
      try {
        await sendAlert({
          type: 'critical_alert', severity: 'critical', title: '严重', message: 'down',
        }, ['feishu']);
        const card = JSON.parse(capturedBody);
        expect(card.msg_type).toBe('interactive');
        expect(card.card.header.title.content).toContain('CRITICAL');
        expect(card.card.elements[0].content).toContain('down');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('events 过滤：仅匹配 type 的配置会触发', async () => {
      const { prisma } = await import('../db');
      (prisma.webhookConfig.findMany as any).mockResolvedValueOnce([
        { id: 'm1', name: 'm', url: 'https://example.com/m', enabled: true, events: 'health_fail', headers: '{}' },
        { id: 'm2', name: 'm2', url: 'https://example.com/m2', enabled: true, events: 'other_*', headers: '{}' },
      ]);
      const originalFetch = global.fetch;
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return { ok: true, status: 200, text: () => Promise.resolve('') };
      });
      try {
        await sendAlert({ type: 'health_fail', severity: 'critical', title: 'h', message: 'm' }, ['webhook']);
        expect(callCount).toBe(1);  // 仅 m1 匹配
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('失败处理', () => {
    it('HTTP 5xx 标记为 failed', async () => {
      const { prisma } = await import('../db');
      (prisma.webhookConfig.findMany as any).mockResolvedValueOnce([
        { id: 'x', name: 'x', url: 'https://example.com/x', enabled: true, events: '', headers: '{}' },
      ]);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('err') });
      try {
        const r = await sendAlert({ type: 'fail_test', severity: 'error', title: 'f', message: 'm' }, ['webhook']);
        const result = r.results[0];
        expect(result.status).toBe('failed');
        expect(result.error).toContain('500');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('网络异常被捕获并标记为 failed', async () => {
      const { prisma } = await import('../db');
      (prisma.webhookConfig.findMany as any).mockResolvedValueOnce([
        { id: 'x', name: 'x', url: 'https://example.com/x', enabled: true, events: '', headers: '{}' },
      ]);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      try {
        const r = await sendAlert({ type: 'net_fail', severity: 'error', title: 'n', message: 'm' }, ['webhook']);
        const result = r.results[0];
        expect(result.status).toBe('failed');
        expect(result.error).toBe('ECONNREFUSED');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('便捷函数', () => {
    it('alertOnHealthFail 触发 critical 级别', async () => {
      const r = await alertOnHealthFail('database', { error: 'connection refused' });
      expect(r.sent).toBe(true);
    });
  });
});
