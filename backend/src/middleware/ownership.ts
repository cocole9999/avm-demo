/**
 * P2-1: 所有权校验中间件 (防止 IDOR)
 *
 * 权限模型:
 * - tenant_admin: 可修改所有资源
 * - space_admin: 可修改所有资源（v1.30 当前未启用空间维度隔离，预留扩展位）
 * - member: 只能修改自己创建的资源 (workItem.reporter 或 project.createdBy)
 *
 * 注: 当前 Project 模型无 spaceId 字段（P2 阶段未引入空间隔离）。
 *     此中间件为安全基线，所有权检查始终生效。
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { AuthedRequest, Role } from './auth';

/**
 * 工作项所有权检查
 * - tenant_admin: 通过
 * - space_admin: 当前与 tenant_admin 等同（空间隔离字段待 P3 引入）
 * - member: 检查 reporter/assignee
 */
export async function checkWorkItemOwnership(
  req: AuthedRequest,
  workItemId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!req.user) return { allowed: false, reason: '未认证' };

  const userRole = req.user.role as Role;

  // tenant_admin / space_admin 可修改所有
  if (userRole === 'tenant_admin' || userRole === 'space_admin') {
    return { allowed: true };
  }

  // 查询工作项
  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      reporter: true,
      assignee: true,
    },
  });

  if (!workItem) {
    return { allowed: false, reason: '工作项不存在' };
  }

  // member: 检查是否是 reporter 或 assignee
  if (workItem.reporter === req.user.username || workItem.assignee === req.user.username) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '无权修改此工作项 (仅创建者或负责人可修改)',
  };
}

/**
 * 项目所有权检查
 * - tenant_admin: 通过
 * - space_admin: 当前与 tenant_admin 等同
 * - member: 检查 createdBy
 */
export async function checkProjectOwnership(
  req: AuthedRequest,
  projectId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!req.user) return { allowed: false, reason: '未认证' };

  const userRole = req.user.role as Role;

  if (userRole === 'tenant_admin' || userRole === 'space_admin') {
    return { allowed: true };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      createdBy: true,
    },
  });

  if (!project) {
    return { allowed: false, reason: '项目不存在' };
  }

  // member: 检查 createdBy
  if (project.createdBy === req.user.username) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '无权修改此项目 (仅创建者可修改)',
  };
}

/**
 * Express 中间件: 工作项所有权检查
 */
export function requireWorkItemOwnership() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const workItemId = req.params.id;
    const result = await checkWorkItemOwnership(req, workItemId);

    if (!result.allowed) {
      return res.status(403).json({
        error: result.reason || '无权访问',
      });
    }

    next();
  };
}

/**
 * Express 中间件: 项目所有权检查
 */
export function requireProjectOwnership() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const projectId = req.params.id;
    const result = await checkProjectOwnership(req, projectId);

    if (!result.allowed) {
      return res.status(403).json({
        error: result.reason || '无权访问',
      });
    }

    next();
  };
}
