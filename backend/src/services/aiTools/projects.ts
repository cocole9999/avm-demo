/**
 * AI 工具 - 项目实体
 * 项目/客户/车型/联系人/外部依赖
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 客户详情 ==========
export const getCustomer: ToolDefinition = {
  name: 'get_customer',
  description: '获取单个客户详情，包含联系人列表和关联项目/工作项数量。对应"客户管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '客户 ID' },
      code: { type: 'string', description: '客户编码' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 至少传一个');
    const c = await prisma.customer.findFirst({
      where: args.id ? { id: args.id } : { code: args.code },
      include: {
        contacts: { orderBy: { createdAt: 'desc' } },
        _count: { select: { projects: true, workItems: true, contacts: true } },
      },
    });
    if (!c) return { error: '客户不存在' };
    return {
      id: c.id, code: c.code, name: c.name, shortName: c.shortName, type: c.type,
      industry: c.industry, contact: c.contact, phone: c.phone, email: c.email,
      address: c.address, description: c.description, status: c.status,
      contacts: c.contacts,
      projectCount: c._count.projects,
      workItemCount: c._count.workItems,
    };
  },
};


// ========== 车型 ==========
export const listCarModels: ToolDefinition = {
  name: 'list_car_models',
  description: '列出车型档案。可按品牌/状态/关键词搜索。对应"车型管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      brand: { type: 'string', description: '品牌模糊搜索' },
      status: { type: 'string', description: 'active/inactive' },
      keyword: { type: 'string', description: '车型名/编码搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.brand) where.brand = { contains: args.brand };
    if (args.status) where.status = args.status;
    if (args.keyword) {
      where.OR = [
        { name: { contains: args.keyword } },
        { code: { contains: args.keyword } },
      ];
    }
    const list = await prisma.carModel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, code: true, name: true, brand: true, series: true,
        launchYear: true, segment: true, platform: true, status: true,
      },
    });
    return list;
  },
};


export const getCarModel: ToolDefinition = {
  name: 'get_car_model',
  description: '获取单个车型详情，包含关联项目/工作项数量。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 至少传一个');
    const m = await prisma.carModel.findFirst({
      where: args.id ? { id: args.id } : { code: args.code },
      include: { _count: { select: { projects: true, workItems: true } } },
    });
    if (!m) return { error: '车型不存在' };
    return { ...m, projectCount: m._count.projects, workItemCount: m._count.workItems };
  },
};


// ===================== 写入工具（Write Tools）V1.31 =====================

// ========== 删除工具（基础实体） ==========
export const deleteCustomer: ToolDefinition = {
  name: 'delete_customer',
  description: '⚠️ 删除客户档案。通过 id 或 code 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, code: { type: 'string' } },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 必填');
    const where = args.id ? { id: args.id } : { code: args.code };
    await prisma.customer.delete({ where });
    return { ok: true, message: `已删除客户 ${args.code || args.id}` };
  },
};


export const deleteCarModel: ToolDefinition = {
  name: 'delete_car_model',
  description: '⚠️ 删除车型档案。通过 id 或 code 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' }, code: { type: 'string' } },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 必填');
    const where = args.id ? { id: args.id } : { code: args.code };
    await prisma.carModel.delete({ where });
    return { ok: true, message: `已删除车型 ${args.code || args.id}` };
  },
};


export const deleteContact: ToolDefinition = {
  name: 'delete_contact',
  description: '⚠️ 删除客户联系人。通过 id 定位。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.contact.delete({ where: { id: args.id } });
    return { ok: true, message: `已删除联系人 ${args.id}` };
  },
};


// ========== 外部依赖详情 ==========
export const getExternalDependency: ToolDefinition = {
  name: 'get_external_dependency',
  description: '获取单个外部依赖详情。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const d = await prisma.externalDependency.findUnique({
      where: { id: args.id },
      include: {
        project: { select: { id: true, code: true, name: true } },
        workItem: { select: { id: true, key: true, title: true } },
        space: { select: { id: true, code: true, name: true } },
      },
    });
    if (!d) return { error: '外部依赖不存在' };
    return d;
  },
};


// ========== 外部依赖 CRUD ==========
export const createExternalDependency: ToolDefinition = {
  name: 'create_external_dependency',
  description: '创建外部依赖（台架/实车/车模/SDB/UE/UI/标定等）。必填：name, type。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', description: '台架/实车/车模/SDB/UE/UI/标定/其他' },
      owner: { type: 'string', description: '负责人' },
      expectedDate: { type: 'string', description: '预计就绪日期 YYYY-MM-DD' },
      status: { type: 'string', description: 'pending/preparing/ready/blocked/cancelled' },
      blocker: { type: 'string', description: '卡点说明' },
      projectId: { type: 'string' },
      workItemId: { type: 'string' },
      spaceId: { type: 'string' },
    },
    required: ['name', 'type'],
  },
  handler: async (args) => {
    const d = await prisma.externalDependency.create({
      data: {
        name: args.name, type: args.type,
        owner: args.owner || '',
        expectedDate: args.expectedDate ? new Date(args.expectedDate) : null,
        status: args.status || 'pending',
        blocker: args.blocker || '',
        projectId: args.projectId || null,
        workItemId: args.workItemId || null,
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: d.id, message: `已创建外部依赖 ${d.name} (${d.type})` };
  },
};


export const updateExternalDependency: ToolDefinition = {
  name: 'update_external_dependency',
  description: '更新外部依赖状态/信息。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      owner: { type: 'string' },
      expectedDate: { type: 'string' },
      actualDate: { type: 'string', description: '实际就绪日期 YYYY-MM-DD' },
      status: { type: 'string' },
      blocker: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'type', 'owner', 'status', 'blocker'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    if (args.expectedDate) data.expectedDate = new Date(args.expectedDate);
    if (args.actualDate) data.actualDate = new Date(args.actualDate);
    const d = await prisma.externalDependency.update({ where: { id: args.id }, data });
    return { ok: true, id: d.id, message: `已更新外部依赖 ${d.name}` };
  },
};


export const deleteExternalDependency: ToolDefinition = {
  name: 'delete_external_dependency',
  description: '⚠️ 删除外部依赖。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.externalDependency.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除外部依赖' };
  },
};

