/**
 * 管理员访问守卫组件 (V1.46.2)
 *
 * 替代 UsersPage / AuditLogsPage 等页面顶部重复的：
 *   if (!isAdmin) { return <Card><LockOutlined/>...权限不足...</Card>; }
 *
 * @example
 *   <AdminOnly requiredRole="tenant_admin" title="用户管理仅限租户管理员访问">
 *     <UsersTable />
 *   </AdminOnly>
 */
import type { ReactNode } from 'react';
import { useAuth } from '../AuthContext';
import { ForbiddenState } from './StateViews';

export interface AdminOnlyProps {
  /** 需要的角色（默认 'tenant_admin'）；可传数组表示多个允许角色 */
  requiredRole?: string | string[];
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  /** 自定义 fallback；不传则用 ForbiddenState */
  fallback?: ReactNode;
}

export function AdminOnly({
  requiredRole = 'tenant_admin',
  title,
  description,
  children,
  fallback,
}: AdminOnlyProps) {
  const { user } = useAuth();
  const role = user?.role || '';
  const allowed = Array.isArray(requiredRole)
    ? requiredRole.includes(role)
    : role === requiredRole || role === 'platform_admin' || role === 'tenant_admin';

  if (!allowed) {
    return <>{fallback ?? <ForbiddenState title={title} description={description} />}</>;
  }
  return <>{children}</>;
}
