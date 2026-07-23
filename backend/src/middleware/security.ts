/**
 * 安全中间件集合 (V1.30)
 *
 * - helmet: 设置安全 HTTP 头 (X-Frame-Options, CSP, HSTS 等)
 * - express-rate-limit: 全局限流 + 登录端点专门限流 (防暴力破解)
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../env';

/** 全局 helmet 配置 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,  // CSP 复杂, 由前端 meta 控制
  crossOriginEmbedderPolicy: false,
  // 允许同源/同子网 (开发模式) + 飞书/钉钉 webhook
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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
