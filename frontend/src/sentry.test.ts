/**
 * Sentry 前端工具测试 (V1.30.3 P2-8)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sentry (frontend)', () => {
  const originalImport = (import.meta as any).env;

  beforeEach(() => {
    vi.resetModules();
    // 默认清空 Sentry DSN
    (import.meta as any).env.VITE_SENTRY_DSN = undefined;
    (import.meta as any).env.VITE_SENTRY_ENABLED = undefined;
  });

  afterEach(() => {
    (import.meta as any).env = { ...originalImport };
  });

  describe('未启用场景', () => {
    it('initSentry 在无 DSN 时不应抛错', async () => {
      const mod = await import('./sentry');
      expect(() => mod.initSentry()).not.toThrow();
      expect(mod.sentryEnabled()).toBe(false);
    });

    it('captureException 在未启用时返回 undefined', async () => {
      const mod = await import('./sentry');
      mod.initSentry();
      expect(mod.captureException(new Error('test'))).toBeUndefined();
    });

    it('captureMessage 在未启用时为 no-op', async () => {
      const mod = await import('./sentry');
      mod.initSentry();
      expect(() => mod.captureMessage('hi', 'info')).not.toThrow();
    });

    it('setUser/clearUser 在未启用时为 no-op', async () => {
      const mod = await import('./sentry');
      mod.initSentry();
      expect(() => mod.setUser({ id: 'u1' })).not.toThrow();
      expect(() => mod.clearUser()).not.toThrow();
    });

    it('addBreadcrumb 在未启用时为 no-op', async () => {
      const mod = await import('./sentry');
      mod.initSentry();
      expect(() => mod.addBreadcrumb('ui', 'click')).not.toThrow();
    });
  });

  describe('PII 脱敏', () => {
    it('敏感字段被替换为 [REDACTED]', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody({ username: 'alice', password: 'p', token: 't', apiKey: 'ak' }) as Record<string, string>;
      expect(out.username).toBe('alice');
      expect(out.password).toBe('[REDACTED]');
      expect(out.token).toBe('[REDACTED]');
      expect(out.apiKey).toBe('[REDACTED]');
    });

    it('嵌套对象中敏感字段也脱敏', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody({
        user: 'alice',
        profile: { token: 'xxx', name: 'a' },
      }) as { user: string; profile: { token: string; name: string } };
      expect(out.user).toBe('alice');
      expect(out.profile.token).toBe('[REDACTED]');
      expect(out.profile.name).toBe('a');
    });

    it('数组中的对象也脱敏', async () => {
      const { sanitizeBody } = await import('./sentry');
      const out = sanitizeBody([
        { name: 'a', secret: 's' },
        { name: 'b', password: 'p' },
      ]) as Array<Record<string, string>>;
      expect(out[0].name).toBe('a');
      expect(out[0].secret).toBe('[REDACTED]');
      expect(out[1].password).toBe('[REDACTED]');
    });

    it('非对象保持原样', async () => {
      const { sanitizeBody } = await import('./sentry');
      expect(sanitizeBody(null)).toBe(null);
      expect(sanitizeBody('x')).toBe('x');
      expect(sanitizeBody(123)).toBe(123);
    });
  });
});
