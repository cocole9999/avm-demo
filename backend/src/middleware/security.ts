/**
 * 安全中间件集合 (V1.30)
 *
 * - helmet: 设置安全 HTTP 头 (X-Frame-Options, CSP, HSTS 等)
 * - express-rate-limit: 全局限流 + 登录端点专门限流 (防暴力破解)
 *
 * V1.46: 生产环境启用严格 CSP + 收紧 CORP；开发模式保持宽松
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../env';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** 全局 helmet 配置 */
export const helmetMiddleware = helmet({
  // V1.46: 生产启用严格 CSP，开发模式关闭（Vite 需 unsafe-eval/inline）
  contentSecurityPolicy: IS_PRODUCTION ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // antd/emotion 运行时注入样式
      imgSrc: ["'self'", 'data:', 'blob:'],      // 头像/截图/图表导出
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],     // WebSocket + API
      frameAncestors: ["'none'"],                 // 防 clickjacking
      objectSrc: ["'none'"],                      // 禁 Flash/Java
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  // V1.46: 生产收紧为 same-origin（无跨域资源需求时更安全）
  crossOriginResourcePolicy: { policy: IS_PRODUCTION ? 'same-origin' : 'cross-origin' },
});

/** 全局 API 限流 (宽松, 防滥用) */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁, 请稍后再试' },
});

/** 登录端点专门限流 (5 次/分钟, 防暴力破解) */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // 成功登录不计入
  message: { error: '登录尝试次数过多, 请 1 分钟后再试' },
});
