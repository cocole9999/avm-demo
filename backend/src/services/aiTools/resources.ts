/**
 * AI 工具 - 资源与基线
 * 资源分配/分析/导入/工作台/基线
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 资源分配 ==========
export const listResourceAllocations: ToolDefinition = {
  name: 'list_resource_allocations',
  description: '列出资源分配（人员-工作项排期）。可按空间/用户/工作项/状态/日期范围过滤。对应"资源管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      userId: { type: 'string' },
      workItemId: { type: 'string' },
      status: { type: 'string', description: 'planned / confirmed / released' },
      startDate: { type: 'string', description: 'YYYY-MM-DD' },
      endDate: { type: 'string', description: 'YYYY-MM-DD' },
      limit: { type: 'number', description: '默认 100' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.userId) where.userId = args.userId;
    if (args.workItemId) where.workItemId = args.workItemId;
    if (args.status) where.status = args.status;
    if (args.startDate || args.endDate) {
      where.endDate = {};
      if (args.startDate) where.endDate.gte = new Date(args.startDate);
      if (args.endDate) where.endDate.lte = new Date(args.endDate);
    }
    const list = await prisma.resourceAllocation.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: Math.min(args.limit || 100, 200),
      select: {
        id: true, userId: true, userName: true, workItemId: true, workItemKey: true,
        workItemTitle: true, startDate: true, endDate: true, allocatedHours: true,
        type: true, status: true, note: true,
      },
    });
    return list;
  },
};


// ========== 资源分析（人力分析） ==========
export const listResourceAnalyses: ToolDefinition = {
  name: 'list_resource_analyses',
  description: '列出资源/人力分析历史记录。对应"人力分析"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      days: { type: 'number', description: '最近 N 天' },
      limit: { type: 'number', description: '默认 20' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.days) where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    const list = await prisma.resourceAnalysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 20, 50),
      select: {
        id: true, spaceId: true, startDate: true, endDate: true,
        result: true, riskCount: true, healthScore: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== 导入任务 ==========
export const listImportJobs: ToolDefinition = {
  name: 'list_import_jobs',
  description: '列出导入任务。可按空间/状态过滤。对应"导入向导"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      status: { type: 'string', description: 'pending / processing / success / failed' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.status) where.status = args.status;
    const list = await prisma.importJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, resource: true, fileName: true, status: true,
        total: true, processed: true, succeeded: true, failed: true,
        createdBy: true, createdAt: true, finishedAt: true,
      },
    });
    return list;
  },
};


// ========== 工作台聚合 ==========
export const getWorkbench: ToolDefinition = {
  name: 'get_workbench',
  description: '获取用户工作台聚合数据：待办工作项、最近通知、收藏、近期活动。对应"工作台"页面。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: '用户 ID（可选）' },
      userName: { type: 'string', description: '用户显示名/用户名（可选）' },
      limit: { type: 'number', description: '默认 20' },
    },
  },
  handler: async (args) => {
    const limit = Math.min(args.limit || 20, 50);
    // 待办工作项（未完成且指派给该用户）
    const todoWhere: any = { status: { notIn: ['已完成', '已关闭', '已驳回', '已发布', '已验收'] } };
    if (args.userName) todoWhere.assignee = args.userName;
    const todos = await prisma.workItem.findMany({
      where: todoWhere,
      orderBy: [{ priority: 'asc' }, { planEnd: 'asc' }],
      take: limit,
      select: { id: true, key: true, title: true, type: true, priority: true, status: true, planEnd: true },
    });
    // 最近通知
    const notifWhere: any = {};
    if (args.userId) notifWhere.recipientId = args.userId;
    const notifications = await prisma.notification.findMany({
      where: notifWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true, content: true, level: true, read: true, createdAt: true },
    });
    // 收藏
    const favWhere: any = {};
    if (args.userId) favWhere.userId = args.userId;
    const favorites = await prisma.favorite.findMany({
      where: favWhere,
      orderBy: { position: 'asc' },
      take: limit,
      select: { id: true, title: true, resourceType: true, link: true, folder: true },
    });
    // 近期活动
    const activityWhere: any = {};
    if (args.userName) activityWhere.actor = args.userName;
    const activities = await prisma.activity.findMany({
      where: activityWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, field: true, actor: true, createdAt: true },
    });
    return { todos, notifications, favorites, activities };
  },
};


// ========== 工作台配置 ==========
export const getWorkbenchConfig: ToolDefinition = {
  name: 'get_workbench_config',
  description: '获取用户工作台配置（布局、默认空间、偏好设置）。对应"工作台"页面配置。',
  parameters: {
    type: 'object',
    properties: { userId: { type: 'string', description: '用户 ID' } },
  },
  handler: async (args) => {
    if (!args.userId) throw new Error('userId 必填');
    const c = await prisma.workbenchConfig.findUnique({ where: { userId: args.userId } });
    if (!c) return { error: '工作台配置不存在' };
    return c;
  },
};


// ========== 资源分配 ==========
export const createResourceAllocation: ToolDefinition = {
  name: 'create_resource_allocation',
  description: '创建资源分配记录。必填：userName, workItemKey, startDate, endDate, allocatedHours。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      userName: { type: 'string', description: '用户名（与 userId 二选一）' },
      workItemKey: { type: 'string', description: '工作项编号（如 REQ-1）' },
      startDate: { type: 'string', description: 'YYYY-MM-DD' },
      endDate: { type: 'string', description: 'YYYY-MM-DD' },
      allocatedHours: { type: 'number', description: '分配工时' },
      type: { type: 'string', description: 'develop/test/review/other' },
      note: { type: 'string' },
      spaceId: { type: 'string' },
    },
    required: ['startDate', 'endDate', 'allocatedHours'],
  },
  handler: async (args) => {
    let userId = args.userId;
    let userName = args.userName;
    if (!userId && userName) {
      const u = await prisma.user.findFirst({ where: { OR: [{ username: userName }, { displayName: userName }] } });
      if (!u) throw new Error(`用户 ${userName} 不存在`);
      userId = u.id; userName = u.displayName;
    }
    if (!userId) throw new Error('必须提供 userId 或 userName');
    let workItemId = '', workItemKey = '', workItemTitle = '';
    if (args.workItemKey) {
      const w = await prisma.workItem.findUnique({ where: { key: args.workItemKey } });
      if (w) { workItemId = w.id; workItemKey = w.key; workItemTitle = w.title; }
    }
    const a = await prisma.resourceAllocation.create({
      data: {
        userId, userName: userName || '',
        workItemId, workItemKey, workItemTitle,
        startDate: new Date(args.startDate), endDate: new Date(args.endDate),
        allocatedHours: args.allocatedHours, type: args.type || 'develop',
        note: args.note || '',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: a.id, message: `已创建资源分配：${userName} ${args.allocatedHours} 小时` };
  },
};


export const updateResourceAllocation: ToolDefinition = {
  name: 'update_resource_allocation',
  description: '更新资源分配。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      allocatedHours: { type: 'number' },
      type: { type: 'string' },
      note: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['type', 'note'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    if (args.startDate) data.startDate = new Date(args.startDate);
    if (args.endDate) data.endDate = new Date(args.endDate);
    if (args.allocatedHours !== undefined) data.allocatedHours = args.allocatedHours;
    const a = await prisma.resourceAllocation.update({ where: { id: args.id }, data });
    return { ok: true, id: a.id, message: '已更新资源分配' };
  },
};


export const deleteResourceAllocation: ToolDefinition = {
  name: 'delete_resource_allocation',
  description: '⚠️ 删除资源分配记录。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.resourceAllocation.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除资源分配' };
  },
};


// ========== 基线 ==========
export const listBaselines: ToolDefinition = {
  name: 'list_baselines',
  description: '列出基线。可按空间/迭代/基线类型过滤。对应"基线"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      iterationId: { type: 'string' },
      baselineType: { type: 'string', description: 'iteration / release / custom' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.iterationId) where.iterationId = args.iterationId;
    if (args.baselineType) where.baselineType = args.baselineType;
    const list = await prisma.baseline.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, iterationName: true, baselineType: true,
        itemCount: true, totalEstimate: true, createdBy: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== 基线 ==========
export const createBaseline: ToolDefinition = {
  name: 'create_baseline',
  description: '创建迭代基线（快照）。必填：name, iterationId 或 iterationName。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '基线名称' },
      iterationId: { type: 'string', description: '迭代 ID' },
      iterationName: { type: 'string', description: '迭代名称' },
      description: { type: 'string' },
      spaceId: { type: 'string' },
    },
    required: ['name'],
  },
  handler: async (args) => {
    let iterationId = args.iterationId;
    let iterationName: string | null = null;
    if (!iterationId && args.iterationName) {
      const it = await prisma.iteration.findUnique({ where: { name: args.iterationName } });
      if (it) { iterationId = it.id; iterationName = it.name; }
    }
    const where: any = {};
    if (iterationId) where.iterationId = iterationId;
    const items = await prisma.workItem.findMany({
      where, select: { id: true, key: true, title: true, status: true, priority: true, assignee: true, estimate: true },
    });
    const totalEstimate = items.reduce((s, i) => s + (i.estimate || 0), 0);
    const b = await prisma.baseline.create({
      data: {
        name: args.name,
        iterationId: iterationId || null,
        iterationName,
        baselineType: iterationId ? 'iteration' : 'space',
        snapshot: JSON.stringify({ items, capturedAt: new Date().toISOString() }),
        itemCount: items.length,
        totalEstimate,
        description: args.description || '',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: b.id, name: b.name, snapshotItemCount: items.length, message: `已创建基线 ${b.name}（${items.length} 个工作项）` };
  },
};

