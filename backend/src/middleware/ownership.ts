/**
 * P2-1: 所有权校验中间件 (防止 IDOR)
 *
 * 权限模型:
 * - tenant_admin: 可修改所有资源
 * - space_admin: 可修改自己管理空间下的资源 (通过 project.spaceId / workItem.project.spaceId 判断)
 * - member: 只能修改自己创建的资源 (workItem.reporter 或 project.createdBy)
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { AuthedRequest, Role } from './auth';

/**
 * 工作项所有权检查
 * - tenant_admin: 通过
 * - space_admin: 检查项目空间权限
 * - member: 检查 reporter/assignee
 */
export async function checkWorkItemOwnership(
  req: AuthedRequest,
  workItemId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!req.user) return { allowed: false, reason: '未认证' };

  const userRole = req.user.role as Role;

  // tenant_admin 可修改所有
  if (userRole === 'tenant_admin') {
    return { allowed: true };
  }

  // 查询工作项及其关联的项目
  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      reporter: true,
      assignee: true,
      project: {
        select: {
          spaceId: true,
          createdBy: true,
        },
      },
    },
  });

  if (!workItem) {
    return { allowed: false, reason: '工作项不存在' };
  }

  // space_admin: 检查是否属于自己管理的空间
  if (userRole === 'space_admin') {
    if (workItem.project?.spaceId) {
      const spaceMember = await prisma.spaceMember.findFirst({
        where: {
          spaceId: workItem.project.spaceId,
          userId: req.user.id,
          role: 'admin',
        },
      });
      if (spaceMember) {
        return { allowed: true };
      }
    }
  }

  // member: 检查是否是 reporter 或 assignee
  if (workItem.reporter === req.user.username || workItem.assignee === req.user.username) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '无权修改此工作项 (仅创建者、负责人或空间管理员可修改)',
  };
}

/**
 * 项目所有权检查
 * - tenant_admin: 通过
 * - space_admin: 检查空间权限
 * - member: 检查 createdBy
 */
export async function checkProjectOwnership(
  req: AuthedRequest,
  projectId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!req.user) return { allowed: false, reason: '未认证' };

  const userRole = req.user.role as Role;

  // tenant_admin 可修改所有
  if (userRole === 'tenant_admin') {
    return { allowed: true };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      spaceId: true,
      createdBy: true,
    },
  });

  if (!project) {
    return { allowed: false, reason: '项目不存在' };
  }

  // space_admin: 检查空间权限
  if (userRole === 'space_admin' && project.spaceId) {
    const spaceMember = await prisma.spaceMember.findFirst({
      where: {
        spaceId: project.spaceId,
        userId: req.user.id,
        role: 'admin',
      },
    });
    if (spaceMember) {
      return { allowed: true };
    }
  }

  // member: 检查 createdBy
  if (project.createdBy === req.user.username) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: '无权修改此项目 (仅创建者或空间管理员可修改)',
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
