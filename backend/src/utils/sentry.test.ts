/**
 * Sentry 工具测试 (V1.30.3 P2-8)
 *
 * 测试目标：
 * 1. 未配置 SENTRY_DSN 时所有调用为 no-op
 * 2. 敏感字段脱敏（password/secret/token/apiKey 等）
 * 3. 嵌套对象递归脱敏
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('utils/sentry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清理 Sentry 相关环境变量
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('未启用场景', () => {
    it('initSentry 在无 DSN 时不应抛错', async () => {
      const { initSentry, sentryEnabled } = await import('./sentry');
      expect(() => initSentry()).not.toThrow();
      expect(sentryEnabled()).toBe(false);
    });

    it('captureException 在未启用时返回 undefined', async () => {
      const { initSentry, captureException, sentryEnabled } = await import('./sentry');
      initSentry();
      expect(sentryEnabled()).toBe(false);
      expect(captureException(new Error('test'))).toBeUndefined();
    });

    it('captureMessage 在未启用时为 no-op', async () => {
      const { initSentry, captureMessage } = await import('./sentry');
      initSentry();
      expect(() => captureMessage('hello', 'info')).not.toThrow();
    });

    it('sentryErrorHandler 在未启用时直接调用 next', async () => {
      const { initSentry, sentryErrorHandler } = await import('./sentry');
      initSentry();
      const errMw = sentryErrorHandler();
      const next2 = vi.fn();
      errMw(new Error('x'), {}, {}, next2);
      expect(next2).toHaveBeenCalled();
    });
  });

  describe('SENTRY_ENABLED=false 强制关闭', () => {
    it('即使配了 DSN 也禁用', async () => {
      process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
      process.env.SENTRY_ENABLED = 'false';
      const { initSentry, sentryEnabled } = await import('./sentry');
      initSentry();
      expect(sentryEnabled()).toBe(false);
    });
  });

  describe('PII 脱敏逻辑', () => {
    it('敏感字段被替换为 [REDACTED]', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody({ username: 'alice', password: 'secret123', apiKey: 'ak' });
      expect(out.username).toBe('alice');
      expect(out.password).toBe('[REDACTED]');
      expect(out.apiKey).toBe('[REDACTED]');
    });

    it('嵌套对象中敏感字段也脱敏', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody({
        user: 'alice',
        session: { token: 'xxx', nested: { apiKey: 'yyy', foo: 'bar' } },
      }) as any;
      expect(out.user).toBe('alice');
      expect(out.session.token).toBe('[REDACTED]');
      expect(out.session.nested.apiKey).toBe('[REDACTED]');
      expect(out.session.nested.foo).toBe('bar');
    });

    it('数组中的对象也被脱敏', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody([
        { name: 'a', secret: 's1' },
        { name: 'b', password: 'p1' },
      ]);
      expect(out[0].name).toBe('a');
      expect(out[0].secret).toBe('[REDACTED]');
      expect(out[1].password).toBe('[REDACTED]');
    });

    it('空值和非对象保持原样', async () => {
      const { sanitizeBody } = await import('./sentry');
      expect(sanitizeBody(null)).toBe(null);
      expect(sanitizeBody(undefined)).toBe(undefined);
      expect(sanitizeBody('string')).toBe('string');
      expect(sanitizeBody(42)).toBe(42);
    });
  });
});
