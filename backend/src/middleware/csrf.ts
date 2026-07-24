/**
 * CSRF Token 中间件 (V1.30.5)
 * 
 * 用于防止跨站请求伪造攻击
 * 注意：对于 API-first 应用（使用 JWT Bearer Token），CSRF 防护通常不是必需的
 * 本中间件为可选功能，适用于使用 Cookie 认证的场景
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// CSRF Token 存储（生产环境建议使用 Redis）
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// Token 有效期：24 小时
const CSRF_TOKEN_TTL = 24 * 60 * 60 * 1000;

/**
 * 生成 CSRF Token
 */
export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CSRF_TOKEN_TTL;
  
  csrfTokens.set(sessionId, { token, expiresAt });
  
  // 清理过期 token
  cleanupExpiredTokens();
  
  return token;
}

/**
 * 验证 CSRF Token
 */
export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  
  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(stored.token, 'hex'),
    Buffer.from(token, 'hex')
  );
}

/**
 * 清理过期 token
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(sessionId);
    }
  }
}

/**
 * CSRF 保护中间件
 * 仅对 POST/PUT/DELETE/PATCH 请求进行验证
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 跳过安全方法
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // 从 session 或用户 ID 获取 sessionId
  const sessionId = (req as any).user?.id || req.ip || 'anonymous';
  
  // 从 header 或 body 获取 token
  const token = req.headers['x-csrf-token'] as string || req.body?._csrf;
  
  if (!token) {
    res.status(403).json({ error: 'CSRF token 缺失' });
    return;
  }
  
  if (!validateCsrfToken(sessionId, token)) {
    res.status(403).json({ error: 'CSRF token 无效或已过期' });
    return;
  }
  
  next();
}

/**
 * 获取 CSRF Token 的路由处理器
 */
export function getCsrfToken(req: Request, res: Response): void {
  const sessionId = (req as any).user?.id || req.ip || 'anonymous';
  const token = generateCsrfToken(sessionId);
  res.json({ csrfToken: token });
}
