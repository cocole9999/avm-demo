/**
 * Auth Middleware (V1.11)
 *
 * 角色层级（从低到高）：
 * - member      = 0  普通成员（只读 + 自己负责的工作项可改）
 * - space_admin = 1  空间管理员（写操作：创建/更新/批量操作）
 * - tenant_admin = 2 租户管理员（最高：删除 + 角色管理 + 租户配置）
 *
 * 模式（通过 ENV 切换）：
 * - production: 严格模式（无 token = 401，权限不足 = 403）
 * - development/test: 宽松模式（无 token 视为 tenant_admin）
 *
 * 用法:
 *   import { requireAuth, requireRole } from '../middleware/auth';
 *   router.post('/xxx', requireAuth, requireRole('space_admin'), handler);
 *   router.delete('/xxx', requireAuth, requireRole('tenant_admin'), handler);
 *   router.get('/xxx', requireAuth, handler);  // 任何登录用户
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { setUser } from '../utils/sentry';

export type Role = 'member' | 'space_admin' | 'tenant_admin';
const ROLE_LEVEL: Record<Role, number> = {
  member: 0,
  space_admin: 1,
  tenant_admin: 2,
};

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// V1.30.3 P0-1: 白名单改为精确路径, 防止 startsWith 绕过
//   旧: '/sso' + startsWith('/sso/') → 整个 SSO 路由无需鉴权 (CVE 级别)
//   新: 只放行具体端点, 其余 SSO 操作需鉴权
const PUBLIC_PATHS_EXACT = new Set([
  '/api/users/login',        // 用户名/密码登录
  '/api/health',             // 健康检查
  '/api/health/deep',        // 深度健康检查
  '/api/llm-settings/health', // LLM 设置健康检查
  '/api/tests/health',       // 测试健康
  '/api/sso/oauth/feishu',           // SSO 飞书登录跳转 (不需要 token)
  '/api/sso/oauth/feishu/callback',  // SSO 飞书回调 (不需要 token)
]);

/** 判断当前请求路径是否在白名单内 (精确匹配, 不用 startsWith) */
function isPublicPath(req: any): boolean {
  // 只用完整路径 (baseUrl + path), 不单独检查 req.path (旧逻辑的漏洞来源)
  const fullPath = (req.baseUrl || '') + (req.path || '');
  if (!fullPath) return false;
  // 精确匹配
  if (PUBLIC_PATHS_EXACT.has(fullPath)) return true;
  // health 子路径 (如 /api/health/deep) 也放行
  if (fullPath === '/api/health' || fullPath === '/api/health/deep') return true;
  return false;
}

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: Role;
    department?: string | null;
  };
}

/** 解析 Authorization: Bearer xxx 头，返回 user，未带则按模式决定 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // V1.11: 白名单直接放行
  if (isPublicPath(req)) return next();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    // P1-5: token 已改为 @unique，用 findUnique 替代 findFirst，确保多设备登录确定性
    const user = await prisma.user.findUnique({ where: { token } });
    if (user && user.active) {
      // V1.30: 检查 token 过期 (tokenExpiresAt 为 null 表示永不过期, 向后兼容旧 token)
      if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() < Date.now()) {
        // 过期: 静默清掉 token, 返回 401
        await prisma.user.update({
          where: { id: user.id },
          data: { token: null, tokenExpiresAt: null },
        }).catch(() => {/* ignore */});
        return res.status(401).json({ error: 'token 已过期, 请重新登录' });
      }
      req.user = {
        id: user.id, username: user.username, displayName: user.displayName,
        role: (user.role as Role) || 'member', department: user.department,
      };
      // V1.30.3 P2-8: 同步用户到 Sentry
      setUser({ id: user.id, username: user.username, role: user.role || 'member' });
      return next();
    }
    return res.status(401).json({ error: '无效或过期的 token' });
  }

  // 无 token
  if (IS_PRODUCTION) {
    return res.status(401).json({ error: '需要登录' });
  }
  // 宽松模式: 给默认 tenant_admin 权限（开发/演示用）
  req.user = {
    id: 'dev-user', username: 'dev', displayName: '开发模式',
    role: 'tenant_admin', department: 'DEV',
  };
  next();
}

/** 工厂: 要求最低角色 */
export function requireRole(minRole: Role) {
  const needLevel = ROLE_LEVEL[minRole] ?? 0;
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: '未鉴权' });
    const haveLevel = ROLE_LEVEL[req.user.role] ?? 0;
    if (haveLevel < needLevel) {
      return res.status(403).json({
        error: '权限不足',
        required: minRole,
        have: req.user.role,
      });
    }
    next();
  };
}

/** 辅助: GET 方法只要 read，写方法要 write (便利工厂) */
export function autoRole() {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (req.method === 'DELETE') return requireRole('tenant_admin')(req, res, next);
    return requireRole('space_admin')(req, res, next);
  };
}
