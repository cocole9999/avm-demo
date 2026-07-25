/**
 * AI 工具 - 工作项核心
 * 工作项查询 + 关系管理
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 工作项详情 ==========
export const getWorkItem: ToolDefinition = {
  name: 'get_work_item',
  description: '获取单个工作项的完整信息（基本信息、评论、活动、子项、关联关系、项目/迭代/客户/车型上下文）。通过 key（如 REQ-1）或 id 查询。',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '工作项编号（如 REQ-1）' },
      id: { type: 'string', description: '工作项 ID' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.key) throw new Error('id 或 key 至少传一个');
    const where = args.id ? { id: args.id } : { key: args.key };
    const item = await prisma.workItem.findUnique({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        iteration: { select: { id: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        carModel: { select: { id: true, code: true, name: true, brand: true } },
        space: { select: { id: true, code: true, name: true } },
        parent: { select: { id: true, key: true, title: true } },
        children: { select: { id: true, key: true, title: true, status: true, priority: true, assignee: true }, take: 50 },
        relatedFrom: { include: { to: { select: { id: true, key: true, title: true, status: true } } }, take: 50 },
        comments: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, author: true, content: true, createdAt: true } },
      },
    });
    if (!item) return { error: '工作项不存在' };
    const activities = await prisma.activity.findMany({
      where: { workItemId: item.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      ...item,
      relations: item.relatedFrom.map(r => ({
        relationId: r.id,
        relationType: r.relationType,
        to: r.to,
      })),
      activities,
    };
  },
};


// ========== 工作项关系 ==========
export const addWorkItemRelation: ToolDefinition = {
  name: 'add_work_item_relation',
  description: '添加工作项关联关系（如阻塞/关联/复制/拆分）。必填：fromKey/fromId, toKey/toId, relationType。',
  parameters: {
    type: 'object',
    properties: {
      fromKey: { type: 'string' },
      fromId: { type: 'string' },
      toKey: { type: 'string' },
      toId: { type: 'string' },
      relationType: { type: 'string', description: 'blocks/relates_to/duplicates/splits_to/parent_child' },
    },
    required: ['relationType'],
  },
  handler: async (args) => {
    let fromId = args.fromId, toId = args.toId;
    if (!fromId && args.fromKey) { const w = await prisma.workItem.findUnique({ where: { key: args.fromKey } }); if (w) fromId = w.id; }
    if (!toId && args.toKey) { const w = await prisma.workItem.findUnique({ where: { key: args.toKey } }); if (w) toId = w.id; }
    if (!fromId || !toId) throw new Error('必须提供 fromKey/fromId 和 toKey/toId');
    const r = await prisma.workItemRelation.create({
      data: { fromId, toId, relationType: args.relationType },
    });
    return { ok: true, id: r.id, message: `已添加关联关系 ${args.relationType}` };
  },
};


export const removeWorkItemRelation: ToolDefinition = {
  name: 'remove_work_item_relation',
  description: '移除工作项关联关系。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.workItemRelation.delete({ where: { id: args.id } });
    return { ok: true, message: '已移除关联关系' };
  },
};

