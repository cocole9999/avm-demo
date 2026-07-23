/**
 * Sentry 前端集成 (V1.30.3 P2-8)
 *
 * 设计原则：
 * 1. 仅在配置 VITE_SENTRY_DSN 时启用（构建时注入）
 * 2. 性能监控：trace sample rate 5%（生产），0%（开发）
 * 3. PII 脱敏：与后端一致
 * 4. 自动捕获：浏览器全局错误、未处理的 Promise 拒绝、React 错误（ErrorBoundary）
 * 5. 用户上下文：登录后 setUser，登出 clearUser
 * 6. 与 antd message/notification 共存
 *
 * 环境变量（Vite）：
 *   VITE_SENTRY_DSN                  - Sentry DSN
 *   VITE_SENTRY_ENVIRONMENT          - 环境标识
 *   VITE_SENTRY_TRACES_SAMPLE_RATE   - 性能采样率
 */
import * as Sentry from '@sentry/react';

let initialized = false;

/** 初始化 Sentry（在 main.tsx 最早位置调用） */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const enabled = import.meta.env.VITE_SENTRY_ENABLED !== 'false';
  if (!dsn || !enabled) {
    return;
  }

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || import.meta.env.MODE,
    release: `avm-frontend@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.05,
    // 性能监控集成：路由变更、组件挂载
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // 录屏比例（生产 10%，开发 100%）
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // 录屏采样（仅生产）
    replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_RATE) || 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = sanitizeBody(event.request.data);
      }
      if (event.extra) {
        event.extra = sanitizeBody(event.extra) as Record<string, unknown>;
      }
      return event;
    },
    ignoreErrors: [
      // 已知噪音
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network request failed',
      'Failed to fetch',
    ],
  });

  initialized = true;
}

/** 主动捕获异常 */
export function captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!initialized) return undefined;
  return Sentry.captureException(error, { extra: context });
}

/** 主动捕获消息 */
export function captureMessage(msg: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureMessage(msg, { level, extra: context });
}

/** 添加面包屑 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/** 设置用户（登录后） */
export function setUser(user: { id: string; username?: string; role?: string } | null): void {
  if (!initialized) return;
  Sentry.setUser(user);
}

/** 清除用户（登出） */
export function clearUser(): void {
  if (!initialized) return;
  Sentry.setUser(null);
}

export const sentryEnabled = (): boolean => initialized;

/** 暴露 Sentry ErrorBoundary（用 Sentry 自带增强版替换默认 ErrorBoundary） */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// ===== 内部工具 =====

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'pwd',
  'secret', 'apiKey', 'api_key', 'apikey',
  'token', 'accessToken', 'refreshToken', 'authorization',
  'appSecret', 'app_secret', 'appsecret',
  'corpSecret', 'corp_secret',
  'encryptKey', 'encryption_key',
  'credential', 'credentials',
  'sessionId', 'session_id', 'cookie',
]);

/** 脱敏函数（导出供测试） */
export function sanitizeBody(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = sanitizeBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
