/**
 * Sentry 错误追踪（V1.30.3 P2-8）
 *
 * 设计原则：
 * 1. 仅在配置 SENTRY_DSN 时启用（默认关闭，不影响开发）
 * 2. PII（个人识别信息）脱敏：request body 中的 password/secret/token 自动过滤
 * 3. 与现有 winston logger 并存：Sentry 捕获异常，logger 记录业务事件
 * 4. 性能监控：trace sample rate 5%（生产），0%（开发）
 * 5. 释放语义：captureException 返回 eventId，方便与日志关联
 *
 * 配置环境变量：
 *   SENTRY_DSN                       - Sentry DSN（必填，未配置则禁用）
 *   SENTRY_ENVIRONMENT               - 环境标识，默认 NODE_ENV
 *   SENTRY_RELEASE                   - 版本标识，默认 package.json version
 *   SENTRY_TRACES_SAMPLE_RATE        - 性能采样率，默认 0.05
 *   SENTRY_ENABLED                   - 总开关（'false' 强制关闭），默认 true
 */
import * as Sentry from '@sentry/node';
import { env } from '../env';

let initialized = false;

/** 初始化 Sentry（在 index.ts 最早位置调用） */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const enabled = process.env.SENTRY_ENABLED !== 'false';
  if (!dsn || !enabled) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `avm-backend@${require('../../package.json').version}`,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.05,
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.05,
    // PII 脱敏
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = sanitizeBody(event.request.data);
      }
      if (event.extra) {
        event.extra = sanitizeExtra(event.extra as Record<string, unknown>);
      }
      return event;
    },
    // 忽略已知噪音
    ignoreErrors: [
      'ECONNRESET',
      'Request aborted',
      'client disconnected',
    ],
  });

  initialized = true;
}

/** Express error handler（在所有路由之后） */
export function sentryErrorHandler() {
  if (!initialized) return (err: any, _req: any, _res: any, next: any) => next(err);
  // Sentry v10: Handlers.errorHandler 已移除，使用 setupExpressErrorHandler
  // 注意：setupExpressErrorHandler 是注册型函数，需要提前在 app 上注册
  // 此处仅返回 next(err)，实际 handler 已在 index.ts 通过 setupExpressErrorHandler 注册
  return (err: any, _req: any, _res: any, next: any) => next(err);
}

/** Sentry v10 推荐做法：在 Express app 上注册错误 handler */
export function setupSentryExpressHandlers(app: any): void {
  if (!initialized) return;
  try {
    // setupExpressErrorHandler 内部读取 defaultIntegrations 中的 requestData
    (Sentry as any).setupExpressErrorHandler(app, {
      shouldHandleError(error: any) {
        const status = error?.status || error?.statusCode || 500;
        return status >= 500;
      },
    });
  } catch (e: any) {
    // 降级：忽略 Sentry 注册错误
    console.warn('[sentry] setupExpressErrorHandler 失败, 已降级', e?.message);
  }
}

/** 主动捕获异常 */
export function captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!initialized) {
    // 即使 Sentry 未启用，也保证调用方拿到 undefined 不报错
    return undefined;
  }
  return Sentry.captureException(error, { extra: context });
}

/** 主动捕获消息 */
export function captureMessage(msg: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureMessage(msg, { level, extra: context });
}

/** 给当前请求加面包屑（异步任务中保留上下文） */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/** 设置用户上下文（登录后调用） */
export function setUser(user: { id: string; username?: string; role?: string } | null): void {
  if (!initialized) return;
  Sentry.setUser(user);
}

export const sentryEnabled = (): boolean => initialized;

// ===== 内部工具 =====

/** 敏感字段（递归脱敏） */
const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'pwd',
  'secret', 'apiKey', 'api_key', 'apikey',
  'token', 'accessToken', 'refreshToken', 'authorization',
  'appSecret', 'app_secret', 'appsecret',
  'corpSecret', 'corp_secret',
  'encryptKey', 'encryption_key',
  'credential', 'credentials',
  'sessionId', 'session_id', 'cookie', 'set-cookie',
]);

/** 脱敏函数（导出供测试） */
export function sanitizeBody(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
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

function sanitizeExtra(extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
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
