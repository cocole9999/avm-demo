/**
 * AI 工具 - 流程与评审
 * 迭代/流程/评审/评论
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 迭代 ==========
export const listIterations: ToolDefinition = {
  name: 'list_iterations',
  description: '列出迭代（冲刺）。可按空间/状态/起止时间/关键词过滤。对应"迭代/甘特图"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string', description: '空间 ID' },
      status: { type: 'string', description: 'planning / active / completed' },
      keyword: { type: 'string', description: '迭代名搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.status) where.status = args.status;
    if (args.keyword) where.name = { contains: args.keyword };
    const list = await prisma.iteration.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: Math.min(args.limit || 50, 100),
      include: {
        space: { select: { code: true, name: true } },
        _count: { select: { workItems: true } },
      },
    });
    return list.map(i => ({ ...i, workItemCount: i._count.workItems }));
  },
};


// ========== 工作流 ==========
export const listFlows: ToolDefinition = {
  name: 'list_flows',
  description: '列出工作流（NodeFlow）。可按工作项类型/是否激活过滤。对应"流程管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      workType: { type: 'string', description: '工作项类型：requirement / task / bug / release' },
      isActive: { type: 'boolean', description: '只看当前生效流程' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.workType) where.workType = args.workType;
    if (args.isActive !== undefined) where.isActive = args.isActive;
    const list = await prisma.nodeFlow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      include: { _count: { select: { nodes: true, transitions: true } } },
    });
    return list.map(f => ({ ...f, nodeCount: f._count.nodes, transitionCount: f._count.transitions }));
  },
};


export const getFlow: ToolDefinition = {
  name: 'get_flow',
  description: '获取单个工作流详情，包含节点和连线。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      workType: { type: 'string', description: '按工作项类型查询当前激活流程' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.workType) throw new Error('id 或 workType 至少传一个');
    const flow = args.id
      ? await prisma.nodeFlow.findUnique({
          where: { id: args.id },
          include: { nodes: true, transitions: true },
        })
      : await prisma.nodeFlow.findFirst({
          where: { workType: args.workType, isActive: true },
          include: { nodes: true, transitions: true },
        });
    if (!flow) return { error: '工作流不存在' };
    return flow;
  },
};


export const deleteIteration: ToolDefinition = {
  name: 'delete_iteration',
  description: '⚠️ 删除迭代（sprint）。通过 id 或 name 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
  },
  handler: async (args) => {
    if (!args.id && !args.name) throw new Error('id 或 name 必填');
    const where = args.id ? { id: args.id } : { name: args.name };
    await prisma.iteration.delete({ where });
    return { ok: true, message: `已删除迭代 ${args.name || args.id}` };
  },
};


export const deleteFlow: ToolDefinition = {
  name: 'delete_flow',
  description: '⚠️ 删除工作流（NodeFlow）及其节点和连线。通过 id 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.nodeFlow.delete({ where: { id: args.id } });
    return { ok: true, message: `已删除工作流 ${args.id}` };
  },
};


// ========== 评审 ==========
export const listReviews: ToolDefinition = {
  name: 'list_reviews',
  description: '列出评审。可按状态/工作项/发起人/评审类型过滤。对应"评审"页面。',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'pending / approved / rejected' },
      workItemId: { type: 'string' },
      initiator: { type: 'string' },
      reviewType: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.workItemId) where.workItemId = args.workItemId;
    if (args.initiator) where.initiator = args.initiator;
    if (args.reviewType) where.reviewType = args.reviewType;
    const list = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      include: {
        workItem: { select: { key: true, title: true } },
        _count: { select: { items: true, participants: true } },
      },
    });
    return list.map(r => ({ ...r, itemCount: r._count.items, participantCount: r._count.participants }));
  },
};


export const getReview: ToolDefinition = {
  name: 'get_review',
  description: '获取单个评审详情，包含评审项和参与人。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const r = await prisma.review.findUnique({
      where: { id: args.id },
      include: {
        workItem: { select: { key: true, title: true } },
        items: true,
        participants: true,
      },
    });
    if (!r) return { error: '评审不存在' };
    return r;
  },
};


// ========== 评审 ==========
export const createReview: ToolDefinition = {
  name: 'create_review',
  description: '创建一个评审。必填：workItemKey/workItemId, reviewType, title, initiator。',
  parameters: {
    type: 'object',
    properties: {
      workItemKey: { type: 'string' },
      workItemId: { type: 'string' },
      reviewType: { type: 'string', description: '需求评审/技术评审/测试评审/发布评审' },
      title: { type: 'string' },
      initiator: { type: 'string', description: '发起人' },
      summary: { type: 'string' },
    },
    required: ['reviewType', 'title', 'initiator'],
  },
  handler: async (args) => {
    let workItemId = args.workItemId;
    if (!workItemId && args.workItemKey) {
      const w = await prisma.workItem.findUnique({ where: { key: args.workItemKey } });
      if (!w) throw new Error(`工作项 ${args.workItemKey} 不存在`);
      workItemId = w.id;
    }
    if (!workItemId) throw new Error('必须提供 workItemKey 或 workItemId');
    const r = await prisma.review.create({
      data: {
        workItemId, reviewType: args.reviewType, title: args.title,
        initiator: args.initiator,
        summary: args.summary || '',
        status: 'pending',
      },
    });
    return { ok: true, id: r.id, message: `已创建${args.reviewType}: ${r.title}` };
  },
};


export const finalizeReview: ToolDefinition = {
  name: 'finalize_review',
  description: '终结评审（通过/驳回）。必填：reviewId, conclusion。',
  parameters: {
    type: 'object',
    properties: {
      reviewId: { type: 'string' },
      conclusion: { type: 'string', description: 'approved/rejected' },
      finalizer: { type: 'string', description: '审批人' },
      summary: { type: 'string', description: '结论摘要' },
    },
    required: ['reviewId', 'conclusion'],
  },
  handler: async (args) => {
    if (!['approved', 'rejected'].includes(args.conclusion)) throw new Error('conclusion 必须是 approved 或 rejected');
    const r = await prisma.review.update({
      where: { id: args.reviewId },
      data: {
        status: args.conclusion === 'approved' ? 'approved' : 'rejected',
        conclusion: args.conclusion,
        finalizer: args.finalizer || 'AI 助理',
        finalizedAt: new Date(),
        summary: args.summary || '',
      },
    });
    return { ok: true, id: r.id, message: `评审已${args.conclusion === 'approved' ? '通过' : '驳回'}` };
  },
};


export const deleteComment: ToolDefinition = {
  name: 'delete_comment',
  description: '⚠️ 删除工作项评论。通过 id 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.comment.delete({ where: { id: args.id } });
    return { ok: true, message: `已删除评论 ${args.id}` };
  },
};

