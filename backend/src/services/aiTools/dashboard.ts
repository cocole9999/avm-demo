/**
 * AI 工具 - 仪表盘与图表
 * 仪表盘 + 图表配置
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 仪表盘/图表 ==========
export const listDashboards: ToolDefinition = {
  name: 'list_dashboards',
  description: '列出仪表盘。可按作用域/目标页面/关键词搜索。对应"仪表盘"页面。',
  parameters: {
    type: 'object',
    properties: {
      scope: { type: 'string', description: 'global / space / custom' },
      target: { type: 'string', description: '目标页面标识' },
      keyword: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.scope) where.scope = args.scope;
    if (args.target) where.target = args.target;
    if (args.keyword) where.name = { contains: args.keyword };
    const list = await prisma.dashboard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      include: { _count: { select: { charts: true } } },
    });
    return list.map(d => ({ ...d, chartCount: d._count.charts }));
  },
};


export const listCharts: ToolDefinition = {
  name: 'list_charts',
  description: '列出图表配置。可按仪表盘/数据源/图表类型过滤。对应"图表编辑器"页面。',
  parameters: {
    type: 'object',
    properties: {
      dashboardId: { type: 'string' },
      source: { type: 'string', description: '数据源：work_items / projects / users' },
      chartType: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.dashboardId) where.dashboardId = args.dashboardId;
    if (args.source) where.source = args.source;
    if (args.chartType) where.chartType = args.chartType;
    const list = await prisma.chartConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, chartType: true, dimensions: true, measures: true,
        source: true, scope: true, dashboardId: true, position: true,
      },
    });
    return list;
  },
};


// ========== 仪表盘详情 ==========
export const getDashboard: ToolDefinition = {
  name: 'get_dashboard',
  description: '获取单个仪表盘详情，包含所有图表配置。对应"仪表盘"页面详情。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '仪表盘 ID' },
      name: { type: 'string', description: '仪表盘名称（可选，按名称匹配）' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.name) throw new Error('id 或 name 至少传一个');
    const d = args.id
      ? await prisma.dashboard.findUnique({ where: { id: args.id }, include: { charts: { orderBy: { position: 'asc' } } } })
      : await prisma.dashboard.findFirst({ where: { name: args.name }, include: { charts: { orderBy: { position: 'asc' } } } });
    if (!d) return { error: '仪表盘不存在' };
    return d;
  },
};


// ========== 仪表盘/图表 CRUD ==========
export const createDashboard: ToolDefinition = {
  name: 'create_dashboard',
  description: '创建仪表盘。必填：name。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      scope: { type: 'string', description: 'global/space/personal/custom' },
      target: { type: 'string', description: '目标页面/空间 ID' },
      layout: { type: 'string', description: '布局 JSON' },
    },
    required: ['name'],
  },
  handler: async (args) => {
    const d = await prisma.dashboard.create({
      data: {
        name: args.name, description: args.description || '',
        scope: args.scope || 'custom', target: args.target || null,
        layout: args.layout || '[]',
      },
    });
    return { ok: true, id: d.id, name: d.name, message: `已创建仪表盘 ${d.name}` };
  },
};


export const updateDashboard: ToolDefinition = {
  name: 'update_dashboard',
  description: '更新仪表盘。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      layout: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'description', 'layout'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const d = await prisma.dashboard.update({ where: { id: args.id }, data });
    return { ok: true, id: d.id, message: `已更新仪表盘 ${d.name}` };
  },
};


export const deleteDashboard: ToolDefinition = {
  name: 'delete_dashboard',
  description: '⚠️ 删除仪表盘及其下所有图表。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.dashboard.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除仪表盘' };
  },
};


export const createChart: ToolDefinition = {
  name: 'create_chart',
  description: '创建图表配置。必填：name, chartType, dimensions, measures。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      chartType: { type: 'string', description: 'bar/line/pie/area/scatter/radar/funnel/table/number/gauge' },
      dimensions: { type: 'string', description: '维度字段（逗号分隔）' },
      measures: { type: 'string', description: '指标字段（逗号分隔）' },
      filters: { type: 'string', description: '过滤条件 JSON' },
      options: { type: 'string', description: '图表选项 JSON' },
      source: { type: 'string', description: 'work_items/projects/test_cases 等' },
      dashboardId: { type: 'string', description: '关联仪表盘 ID' },
    },
    required: ['name', 'chartType', 'dimensions', 'measures'],
  },
  handler: async (args) => {
    const c = await prisma.chartConfig.create({
      data: {
        name: args.name, chartType: args.chartType,
        dimensions: args.dimensions, measures: args.measures,
        filters: args.filters || '[]', options: args.options || '{}',
        source: args.source || 'work_items',
        dashboardId: args.dashboardId || null,
      },
    });
    return { ok: true, id: c.id, name: c.name, message: `已创建图表 ${c.name}` };
  },
};


export const updateChart: ToolDefinition = {
  name: 'update_chart',
  description: '更新图表配置。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      chartType: { type: 'string' },
      dimensions: { type: 'string' },
      measures: { type: 'string' },
      filters: { type: 'string' },
      options: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'chartType', 'dimensions', 'measures', 'filters', 'options'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const c = await prisma.chartConfig.update({ where: { id: args.id }, data });
    return { ok: true, id: c.id, message: `已更新图表 ${c.name}` };
  },
};


export const deleteChart: ToolDefinition = {
  name: 'delete_chart',
  description: '⚠️ 删除图表配置。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.chartConfig.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除图表' };
  },
};

