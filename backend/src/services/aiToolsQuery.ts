/**
 * AI 查询类工具集（V1.31）
 * 覆盖 AVM 所有功能页面的核心只读查询，让 LLM 在需要时能获取真实数据。
 */
import { prisma } from '../db';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

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

// ========== 用户/成员 ==========
export const listUsers: ToolDefinition = {
  name: 'list_users',
  description: '列出系统用户/成员。可按角色/部门/状态/关键词搜索。对应"用户管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: '角色：tenant_admin / space_admin / member / pm 等' },
      department: { type: 'string', description: '部门模糊搜索' },
      active: { type: 'boolean', description: '是否启用' },
      keyword: { type: 'string', description: '用户名/显示名搜索' },
      limit: { type: 'number', description: '返回数量上限，默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.role) where.role = args.role;
    if (args.department) where.department = { contains: args.department };
    if (args.active !== undefined) where.active = args.active;
    if (args.keyword) {
      where.OR = [
        { username: { contains: args.keyword } },
        { displayName: { contains: args.keyword } },
        { email: { contains: args.keyword } },
      ];
    }
    const list = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, username: true, displayName: true, email: true,
        department: true, role: true, active: true, lastLoginAt: true,
      },
    });
    return list;
  },
};

// ========== 空间 ==========
export const listSpaces: ToolDefinition = {
  name: 'list_spaces',
  description: '列出空间（项目空间）。对应"空间切换/空间管理"相关页面。',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'active/inactive' },
      keyword: { type: 'string', description: '空间名/编码搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.keyword) {
      where.OR = [
        { name: { contains: args.keyword } },
        { code: { contains: args.keyword } },
      ];
    }
    const list = await prisma.space.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, code: true, name: true, description: true, icon: true,
        status: true, ownerId: true, memberCount: true, itemCount: true, createdAt: true,
      },
    });
    return list;
  },
};

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

// ========== 活动/动态 ==========
export const listActivities: ToolDefinition = {
  name: 'list_activities',
  description: '列出系统活动动态。可按工作项/操作人/操作类型过滤。常用于查看工作项变更历史。',
  parameters: {
    type: 'object',
    properties: {
      workItemId: { type: 'string', description: '只看某个工作项的动态' },
      actor: { type: 'string', description: '操作人' },
      action: { type: 'string', description: '操作类型：create / update / status_change / comment 等' },
      limit: { type: 'number', description: '默认 30' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.workItemId) where.workItemId = args.workItemId;
    if (args.actor) where.actor = args.actor;
    if (args.action) where.action = args.action;
    const list = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 30, 100),
    });
    return list;
  },
};

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

// ========== 测试管理 ==========
export const listTestCases: ToolDefinition = {
  name: 'list_test_cases',
  description: '列出测试用例。可按空间/优先级/状态/模块/类型/关键词搜索。对应"测试管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      priority: { type: 'string', description: 'P0/P1/P2/P3' },
      status: { type: 'string', description: 'active / deprecated / draft' },
      module: { type: 'string' },
      caseType: { type: 'string', description: 'functional / performance / compatibility / automation' },
      automated: { type: 'boolean' },
      keyword: { type: 'string', description: '标题/编码搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.priority) where.priority = args.priority;
    if (args.status) where.status = args.status;
    if (args.module) where.module = { contains: args.module };
    if (args.caseType) where.caseType = args.caseType;
    if (args.automated !== undefined) where.automated = args.automated;
    if (args.keyword) {
      where.OR = [
        { title: { contains: args.keyword } },
        { code: { contains: args.keyword } },
      ];
    }
    const list = await prisma.testCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, code: true, title: true, caseType: true, priority: true,
        module: true, tags: true, status: true, automated: true, workItemKey: true,
      },
    });
    return list;
  },
};

export const listTestPlans: ToolDefinition = {
  name: 'list_test_plans',
  description: '列出测试计划。可按空间/状态/迭代过滤。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      status: { type: 'string', description: 'draft / running / completed / aborted' },
      iterationId: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.status) where.status = args.status;
    if (args.iterationId) where.iterationId = args.iterationId;
    const list = await prisma.testPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, status: true, iterationName: true,
        totalCases: true, passedCases: true, failedCases: true,
        blockedCases: true, skippedCases: true, startDate: true, endDate: true,
      },
    });
    return list;
  },
};

// ========== 审计日志 ==========
export const listAuditLogs: ToolDefinition = {
  name: 'list_audit_logs',
  description: '列出审计日志。可按实体/操作/操作人/最近天数过滤。对应"审计日志"页面。',
  parameters: {
    type: 'object',
    properties: {
      entity: { type: 'string', description: 'project / customer / workItem / user / carModel / contact / dependency / auth 等' },
      action: { type: 'string', description: 'create / update / delete / login / status_change 等' },
      actor: { type: 'string' },
      days: { type: 'number', description: '最近 N 天，默认 7' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.entity) where.entity = args.entity;
    if (args.action) where.action = args.action;
    if (args.actor) where.actor = args.actor;
    if (args.days) {
      where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    }
    const list = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, entity: true, entityId: true, action: true, actor: true,
        actorRole: true, changes: true, meta: true, createdAt: true,
      },
    });
    return list;
  },
};

// ========== 自动化规则 ==========
export const listAutomationRules: ToolDefinition = {
  name: 'list_automation_rules',
  description: '列出自动化规则。可按空间/启用状态过滤。对应"自动化"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      enabled: { type: 'boolean' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.automationRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, description: true, enabled: true, trigger: true,
        conditions: true, actions: true, runCount: true, lastRunAt: true,
      },
    });
    return list;
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

// ========== 测试执行 ==========
export const listTestRuns: ToolDefinition = {
  name: 'list_test_runs',
  description: '列出测试执行（TestRun）。可按计划/执行人/状态过滤。对应"测试管理-执行"页面。',
  parameters: {
    type: 'object',
    properties: {
      planId: { type: 'string', description: '测试计划 ID' },
      runnerId: { type: 'string', description: '执行人 ID' },
      status: { type: 'string', description: 'running / completed / aborted' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.planId) where.planId = args.planId;
    if (args.runnerId) where.runnerId = args.runnerId;
    if (args.status) where.status = args.status;
    const list = await prisma.testRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, planId: true, planName: true, runnerId: true, runnerName: true,
        passed: true, failed: true, blocked: true, skipped: true, status: true,
        notes: true, startedAt: true, finishedAt: true,
      },
    });
    return list;
  },
};

export const getTestRun: ToolDefinition = {
  name: 'get_test_run',
  description: '获取单个测试执行详情。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const r = await prisma.testRun.findUnique({ where: { id: args.id } });
    if (!r) return { error: '测试执行不存在' };
    return r;
  },
};

// ========== 空间成员 ==========
export const listSpaceMembers: ToolDefinition = {
  name: 'list_space_members',
  description: '列出空间成员。对应"空间管理-成员"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string', description: '空间 ID' },
      role: { type: 'string', description: '成员角色' },
      keyword: { type: 'string', description: '用户名搜索' },
      limit: { type: 'number', description: '默认 100' },
    },
  },
  handler: async (args) => {
    if (!args.spaceId) throw new Error('spaceId 必填');
    const where: any = { spaceId: args.spaceId };
    if (args.role) where.role = args.role;
    if (args.keyword) {
      where.OR = [
        { userName: { contains: args.keyword } },
        { userId: { contains: args.keyword } },
      ];
    }
    const list = await prisma.spaceMember.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
      take: Math.min(args.limit || 100, 200),
      include: { space: { select: { code: true, name: true } } },
    });
    return list;
  },
};

// ========== 租户信息 ==========
export const getTenant: ToolDefinition = {
  name: 'get_tenant',
  description: '获取当前租户信息。对应"租户设置"页面。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '租户 ID' },
      code: { type: 'string', description: '租户编码' },
    },
  },
  handler: async (args) => {
    const t = args.id
      ? await prisma.tenant.findUnique({ where: { id: args.id }, include: { ssoSettings: true } })
      : args.code
        ? await prisma.tenant.findUnique({ where: { code: args.code }, include: { ssoSettings: true } })
        : await prisma.tenant.findFirst({ include: { ssoSettings: true } });
    if (!t) return { error: '租户不存在' };
    const userCount = await prisma.user.count({ where: { tenantId: t.id } });
    return { ...t, userCount };
  },
};

// ========== Webhook ==========
export const listWebhooks: ToolDefinition = {
  name: 'list_webhooks',
  description: '列出 Webhook 配置。对应"Webhook 管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      enabled: { type: 'boolean', description: '只看启用/禁用' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.webhookConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, url: true, events: true, enabled: true,
        retryCount: true, totalCalls: true, successCalls: true, failedCalls: true,
        lastCallAt: true, lastCallStatus: true, createdAt: true,
      },
    });
    return list;
  },
};

// ========== 工作项模板 ==========
export const listTemplates: ToolDefinition = {
  name: 'list_templates',
  description: '列出工作项模板。可按类型/分类/空间过滤。对应"模板管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      workType: { type: 'string', description: 'requirement / task / bug / release' },
      category: { type: 'string' },
      keyword: { type: 'string', description: '模板名搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.workType) where.workType = args.workType;
    if (args.category) where.category = args.category;
    if (args.keyword) where.name = { contains: args.keyword };
    const list = await prisma.workItemTemplate.findMany({
      where,
      orderBy: { useCount: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, workType: true, category: true, description: true,
        defaultFields: true, childItems: true, useCount: true, tags: true, createdBy: true,
      },
    });
    return list;
  },
};

// ========== 自定义字段（公式/汇总） ==========
export const listFormulaFields: ToolDefinition = {
  name: 'list_formula_fields',
  description: '列出公式字段。对应"自定义字段-公式"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      workType: { type: 'string' },
      enabled: { type: 'boolean' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.workType) where.workType = args.workType;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.formulaField.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, fieldKey: true, workType: true, formula: true,
        outputType: true, format: true, enabled: true, description: true,
      },
    });
    return list;
  },
};

export const listRollupFields: ToolDefinition = {
  name: 'list_rollup_fields',
  description: '列出汇总字段（Rollup）。对应"自定义字段-汇总"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      workType: { type: 'string' },
      enabled: { type: 'boolean' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.workType) where.workType = args.workType;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.rollupField.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, name: true, fieldKey: true, workType: true, childType: true,
        sourceField: true, aggregation: true, outputType: true, enabled: true,
      },
    });
    return list;
  },
};

// ========== AI 报告历史 ==========
export const listAIReports: ToolDefinition = {
  name: 'list_ai_reports',
  description: '列出 AI 生成的周报/月报/季报历史。对应"报表中心"页面。',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'week / month / quarter / custom' },
      projectCode: { type: 'string' },
      userFilter: { type: 'string' },
      limit: { type: 'number', description: '默认 10' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.type) where.type = args.type;
    if (args.projectCode) where.projectCode = args.projectCode;
    if (args.userFilter) where.userFilter = args.userFilter;
    const list = await prisma.aIReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 10, 50),
      select: {
        id: true, type: true, periodLabel: true, startDate: true, endDate: true,
        summary: true, llmModel: true, userFilter: true, projectCode: true,
        createdBy: true, createdAt: true,
      },
    });
    return list;
  },
};

// ========== 收藏 ==========
export const listFavorites: ToolDefinition = {
  name: 'list_favorites',
  description: '列出用户收藏/快捷入口。对应"我的收藏"页面。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: '用户 ID' },
      resourceType: { type: 'string', description: 'work_item / project / dashboard 等' },
      folder: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.userId) where.userId = args.userId;
    if (args.resourceType) where.resourceType = args.resourceType;
    if (args.folder) where.folder = args.folder;
    const list = await prisma.favorite.findMany({
      where,
      orderBy: { position: 'asc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, userId: true, resourceType: true, resourceId: true,
        title: true, subtitle: true, icon: true, link: true, folder: true, position: true,
      },
    });
    return list;
  },
};

// ========== 工作交接 ==========
export const listWorkHandovers: ToolDefinition = {
  name: 'list_work_handovers',
  description: '列出工作交接记录。对应"工作交接"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      fromUserId: { type: 'string' },
      toUserId: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.fromUserId) where.fromUserId = args.fromUserId;
    if (args.toUserId) where.toUserId = args.toUserId;
    const list = await prisma.workHandover.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, fromUserId: true, fromUserName: true, toUserId: true, toUserName: true,
        workItemIds: true, reason: true, status: true, createdAt: true,
      },
    });
    return list;
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

// ========== LLM 设置 ==========
export const listLLMSettings: ToolDefinition = {
  name: 'list_llm_settings',
  description: '列出已配置的 LLM 大模型 provider 设置（含启用状态、主 provider、模型、温度、maxTokens，不含完整 API Key）。对应"大模型设置"页面。',
  parameters: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: '只看启用的 provider' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.lLMSettings.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, provider: true, name: true, baseUrl: true, model: true,
        currentModel: true, temperature: true, maxTokens: true, enabled: true,
        isPrimary: true, note: true, customModels: true, createdAt: true, updatedAt: true,
      },
    });
    return list.map(s => ({ ...s, apiKey: '' }));
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

// ========== 自动化规则执行日志 ==========
export const listAutomationLogs: ToolDefinition = {
  name: 'list_automation_logs',
  description: '列出自动化规则的执行日志。对应"自动化"页面的执行历史。',
  parameters: {
    type: 'object',
    properties: {
      ruleId: { type: 'string', description: '规则 ID' },
      status: { type: 'string', description: 'success / failed / skipped' },
      days: { type: 'number', description: '最近 N 天' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.ruleId) where.ruleId = args.ruleId;
    if (args.status) where.status = args.status;
    if (args.days) where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    const list = await prisma.automationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, ruleId: true, ruleName: true, triggerContext: true,
        conditionsResult: true, actionsExecuted: true, status: true, error: true, createdAt: true,
      },
    });
    return list;
  },
};

// ========== Webhook 调用日志 ==========
export const listWebhookLogs: ToolDefinition = {
  name: 'list_webhook_logs',
  description: '列出 Webhook 调用日志。对应 Webhook 配置页面的调用历史。',
  parameters: {
    type: 'object',
    properties: {
      configId: { type: 'string', description: 'Webhook 配置 ID' },
      status: { type: 'string', description: 'success / failed' },
      days: { type: 'number', description: '最近 N 天' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.configId) where.configId = args.configId;
    if (args.status) where.status = args.status;
    if (args.days) where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    const list = await prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, configId: true, event: true, status: true, statusCode: true,
        duration: true, error: true, createdAt: true,
      },
    });
    return list;
  },
};

// ========== SSO 设置与日志 ==========
export const listSSOSettings: ToolDefinition = {
  name: 'list_sso_settings',
  description: '列出单点登录（SSO）配置。对应"租户设置-SSO"页面。',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'feishu / dingtalk / wechatwork / saml / oidc' },
      enabled: { type: 'boolean' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.provider) where.provider = args.provider;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.sSOSetting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, tenantId: true, provider: true, enabled: true,
        appId: true, redirectUri: true, corpId: true, agentId: true,
        config: true, createdAt: true, updatedAt: true,
      },
    });
    return list.map(s => ({ ...s, appSecret: '' }));
  },
};

export const listSSOLogs: ToolDefinition = {
  name: 'list_sso_logs',
  description: '列出 SSO 登录/绑定日志。对应"审计日志"中的 SSO 相关记录。',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      action: { type: 'string', description: 'login / bind / unbind' },
      userKey: { type: 'string' },
      days: { type: 'number', description: '最近 N 天' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.provider) where.provider = args.provider;
    if (args.action) where.action = args.action;
    if (args.userKey) where.userKey = args.userKey;
    if (args.days) where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    const list = await prisma.sSOLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, tenantId: true, provider: true, userKey: true, userName: true,
        action: true, ip: true, userAgent: true, success: true, errorMsg: true, createdAt: true,
      },
    });
    return list;
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

// ========== 空间管理 ==========
export const createSpace: ToolDefinition = {
  name: 'create_space',
  description: '创建一个项目空间。必填：name, code。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '空间名称' },
      code: { type: 'string', description: '空间编码（唯一）' },
      description: { type: 'string' },
      icon: { type: 'string', description: '图标名' },
      ownerId: { type: 'string', description: '负责人用户 ID' },
    },
    required: ['name', 'code'],
  },
  handler: async (args) => {
    if (!args.name || !args.code) throw new Error('name 和 code 必填');
    const s = await prisma.space.create({
      data: {
        name: args.name, code: args.code,
        description: args.description || '',
        icon: args.icon || 'project',
        ownerId: args.ownerId || null,
        status: 'active',
      },
    });
    return { ok: true, id: s.id, code: s.code, message: `已创建空间 ${s.code}: ${s.name}` };
  },
};

export const updateSpace: ToolDefinition = {
  name: 'update_space',
  description: '更新空间信息。通过 id 或 code 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      status: { type: 'string', description: 'active/inactive' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 必填');
    const where = args.id ? { id: args.id } : { code: args.code };
    const data: any = {};
    ['name', 'description', 'icon', 'status'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const s = await prisma.space.update({ where, data });
    return { ok: true, code: s.code, message: `已更新空间 ${s.code}` };
  },
};

export const addSpaceMember: ToolDefinition = {
  name: 'add_space_member',
  description: '向空间添加成员。必填：spaceId/spaceCode, userId/userName, role。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      spaceCode: { type: 'string' },
      userId: { type: 'string' },
      userName: { type: 'string', description: '用户名（显示名）' },
      role: { type: 'string', description: 'admin/member/guest' },
    },
    required: ['role'],
  },
  handler: async (args) => {
    let spaceId = args.spaceId;
    if (!spaceId && args.spaceCode) {
      const s = await prisma.space.findUnique({ where: { code: args.spaceCode } });
      if (!s) throw new Error(`空间 ${args.spaceCode} 不存在`);
      spaceId = s.id;
    }
    if (!spaceId) throw new Error('必须提供 spaceId 或 spaceCode');
    let userId = args.userId;
    let userName = args.userName;
    if (!userId) {
      const u = await prisma.user.findFirst({ where: { OR: [{ username: userName }, { displayName: userName }] } });
      if (!u) throw new Error(`用户 ${userName} 不存在`);
      userId = u.id;
      userName = u.displayName;
    } else if (!userName) {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (u) userName = u.displayName;
    }
    const m = await prisma.spaceMember.create({
      data: { spaceId, userId, userName: userName || '', role: args.role || 'member' },
    });
    return { ok: true, id: m.id, message: `已添加成员 ${userName} 到空间` };
  },
};

export const removeSpaceMember: ToolDefinition = {
  name: 'remove_space_member',
  description: '从空间移除成员。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string', description: 'SpaceMember ID' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.spaceMember.delete({ where: { id: args.id } });
    return { ok: true, message: '已移除空间成员' };
  },
};

// ========== 用户管理 ==========
export const createUser: ToolDefinition = {
  name: 'create_user',
  description: '创建系统用户。必填：username, displayName, password。',
  parameters: {
    type: 'object',
    properties: {
      username: { type: 'string' },
      displayName: { type: 'string' },
      password: { type: 'string', description: '登录密码（至少8位，含数字和字母）' },
      email: { type: 'string' },
      department: { type: 'string' },
      role: { type: 'string', description: 'member/space_admin/tenant_admin' },
    },
    required: ['username', 'displayName', 'password'],
  },
  handler: async (args) => {
    if (!args.username || !args.displayName || !args.password) throw new Error('username/displayName/password 必填');
    const { hashPassword } = await import('../utils/password');
    const u = await prisma.user.create({
      data: {
        username: args.username, displayName: args.displayName,
        password: await hashPassword(args.password),
        email: args.email || null,
        department: args.department || null,
        role: args.role || 'member',
        active: true,
      },
    });
    return { ok: true, id: u.id, username: u.username, message: `已创建用户 ${u.username}` };
  },
};

export const updateUser: ToolDefinition = {
  name: 'update_user',
  description: '更新用户信息（不改密码）。通过 id 或 username 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      displayName: { type: 'string' },
      email: { type: 'string' },
      department: { type: 'string' },
      role: { type: 'string' },
      active: { type: 'boolean' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.username) throw new Error('id 或 username 必填');
    const where = args.id ? { id: args.id } : { username: args.username };
    const data: any = {};
    ['displayName', 'email', 'department', 'role', 'active'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const u = await prisma.user.update({ where, data });
    return { ok: true, username: u.username, message: `已更新用户 ${u.username}` };
  },
};

export const resetUserPassword: ToolDefinition = {
  name: 'reset_user_password',
  description: '重置用户密码。⚠️ 需要 tenant_admin 权限。通过 id 或 username 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      newPassword: { type: 'string', description: '新密码（至少8位，含数字和字母）' },
    },
    required: ['newPassword'],
  },
  handler: async (args) => {
    if (!args.id && !args.username) throw new Error('id 或 username 必填');
    const where = args.id ? { id: args.id } : { username: args.username };
    const { hashPassword } = await import('../utils/password');
    await prisma.user.update({
      where,
      data: { password: await hashPassword(args.newPassword), token: null, tokenExpiresAt: null },
    });
    return { ok: true, message: '密码已重置，用户需重新登录' };
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

// ========== 测试用例/计划/执行 ==========
export const createTestCase: ToolDefinition = {
  name: 'create_test_case',
  description: '创建测试用例。必填：title, module。',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      module: { type: 'string', description: '所属模块' },
      caseType: { type: 'string', description: 'functional/performance/compatibility/security' },
      priority: { type: 'string', description: 'P0/P1/P2/P3' },
      preconditions: { type: 'string', description: '前置条件' },
      steps: { type: 'string', description: '测试步骤 JSON 数组' },
      expectedResult: { type: 'string' },
      workItemKey: { type: 'string', description: '关联工作项编号' },
      spaceId: { type: 'string' },
    },
    required: ['title', 'module'],
  },
  handler: async (args) => {
    const existing = await prisma.testCase.findMany({ where: { code: { startsWith: 'TC-' } }, select: { code: true } });
    let maxNum = 0;
    for (const e of existing) { const m = e.code.match(/^TC-(\d+)$/); if (m) maxNum = Math.max(maxNum, parseInt(m[1])); }
    const code = `TC-${String(maxNum + 1).padStart(4, '0')}`;
    let workItemId: string | null = null, workItemKey: string | null = null;
    if (args.workItemKey) {
      const w = await prisma.workItem.findUnique({ where: { key: args.workItemKey } });
      if (w) { workItemId = w.id; workItemKey = w.key; }
    }
    const tc = await prisma.testCase.create({
      data: {
        code, title: args.title, module: args.module,
        caseType: args.caseType || 'functional', priority: args.priority || 'P2',
        preconditions: args.preconditions || '', steps: args.steps || '[]',
        expectedResult: args.expectedResult || '',
        workItemId, workItemKey, spaceId: args.spaceId || null,
        status: 'active',
      },
    });
    return { ok: true, id: tc.id, code: tc.code, message: `已创建测试用例 ${tc.code}: ${tc.title}` };
  },
};

export const updateTestCase: ToolDefinition = {
  name: 'update_test_case',
  description: '更新测试用例。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string' },
      title: { type: 'string' },
      priority: { type: 'string' },
      status: { type: 'string', description: '待执行/通过/失败/阻塞/跳过' },
      owner: { type: 'string' },
      steps: { type: 'string' },
      expectedResult: { type: 'string' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 必填');
    const where = args.id ? { id: args.id } : { code: args.code };
    const data: any = {};
    ['title', 'priority', 'status', 'owner', 'steps', 'expectedResult'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const tc = await prisma.testCase.update({ where, data });
    return { ok: true, code: tc.code, message: `已更新测试用例 ${tc.code}` };
  },
};

export const createTestPlan: ToolDefinition = {
  name: 'create_test_plan',
  description: '创建测试计划。必填：name, startDate, endDate。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
      endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
      ownerName: { type: 'string', description: '负责人姓名' },
      description: { type: 'string', description: '测试范围/说明' },
      spaceId: { type: 'string' },
    },
    required: ['name', 'startDate', 'endDate'],
  },
  handler: async (args) => {
    const tp = await prisma.testPlan.create({
      data: {
        name: args.name,
        startDate: new Date(args.startDate),
        endDate: new Date(args.endDate),
        ownerName: args.ownerName || '',
        description: args.description || '',
        spaceId: args.spaceId || null,
        status: 'draft',
      },
    });
    return { ok: true, id: tp.id, name: tp.name, message: `已创建测试计划 ${tp.name}` };
  },
};

export const createTestRun: ToolDefinition = {
  name: 'create_test_run',
  description: '创建测试执行记录（执行测试计划）。必填：planId, runnerName。',
  parameters: {
    type: 'object',
    properties: {
      planId: { type: 'string' },
      runnerName: { type: 'string', description: '执行人姓名' },
      notes: { type: 'string', description: '执行备注' },
    },
    required: ['planId', 'runnerName'],
  },
  handler: async (args) => {
    const plan = await prisma.testPlan.findUnique({ where: { id: args.planId } });
    if (!plan) throw new Error('测试计划不存在');
    const tr = await prisma.testRun.create({
      data: {
        planId: args.planId, planName: plan.name,
        runnerName: args.runnerName, runnerId: '',
        notes: args.notes || '',
        status: 'running',
        startedAt: new Date(),
        caseIds: '[]',
      },
    });
    return { ok: true, id: tr.id, message: `已创建测试执行，执行人: ${args.runnerName}` };
  },
};

// ========== 自动化规则 ==========
export const createAutomationRule: ToolDefinition = {
  name: 'create_automation_rule',
  description: '创建自动化规则。必填：name, trigger, actions。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      trigger: { type: 'string', description: '触发事件：workitem_created/status_changed/priority_changed/comment_added/iteration_started 等' },
      conditions: { type: 'string', description: '触发条件 JSON' },
      actions: { type: 'string', description: '执行动作 JSON（必填）' },
      enabled: { type: 'boolean' },
    },
    required: ['name', 'trigger', 'actions'],
  },
  handler: async (args) => {
    let actionsJson = args.actions;
    if (typeof actionsJson === 'string') { try { actionsJson = JSON.parse(actionsJson); } catch { /* keep as string */ } }
    const r = await prisma.automationRule.create({
      data: {
        name: args.name, description: args.description || '',
        trigger: args.trigger,
        conditions: args.conditions || '[]',
        actions: typeof actionsJson === 'string' ? actionsJson : JSON.stringify(actionsJson),
        enabled: args.enabled !== false,
      },
    });
    return { ok: true, id: r.id, name: r.name, message: `已创建自动化规则 ${r.name}` };
  },
};

export const updateAutomationRule: ToolDefinition = {
  name: 'update_automation_rule',
  description: '更新自动化规则。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      conditions: { type: 'string' },
      actions: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'description', 'conditions', 'actions'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const r = await prisma.automationRule.update({ where: { id: args.id }, data });
    return { ok: true, id: r.id, message: `已更新自动化规则 ${r.name}` };
  },
};

export const deleteAutomationRule: ToolDefinition = {
  name: 'delete_automation_rule',
  description: '⚠️ 删除自动化规则。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.automationRule.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除自动化规则' };
  },
};

export const toggleAutomationRule: ToolDefinition = {
  name: 'toggle_automation_rule',
  description: '启用或禁用自动化规则。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      enabled: { type: 'boolean' },
    },
    required: ['id', 'enabled'],
  },
  handler: async (args) => {
    const r = await prisma.automationRule.update({ where: { id: args.id }, data: { enabled: args.enabled } });
    return { ok: true, id: r.id, enabled: r.enabled, message: `自动化规则已${r.enabled ? '启用' : '禁用'}` };
  },
};

// ========== Webhook ==========
export const createWebhook: ToolDefinition = {
  name: 'create_webhook',
  description: '创建 Webhook 配置。必填：name, url, events。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      url: { type: 'string', description: '回调 URL' },
      events: { type: 'string', description: '订阅事件，逗号分隔（如 workitem_created,status_changed）' },
      secret: { type: 'string', description: '签名密钥' },
      enabled: { type: 'boolean' },
    },
    required: ['name', 'url', 'events'],
  },
  handler: async (args) => {
    const w = await prisma.webhookConfig.create({
      data: {
        name: args.name, url: args.url,
        events: args.events, secret: args.secret || '',
        enabled: args.enabled !== false,
      },
    });
    return { ok: true, id: w.id, name: w.name, message: `已创建 Webhook ${w.name}` };
  },
};

export const updateWebhook: ToolDefinition = {
  name: 'update_webhook',
  description: '更新 Webhook 配置。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string' },
      events: { type: 'string' },
      secret: { type: 'string' },
      enabled: { type: 'boolean' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'url', 'events', 'secret', 'enabled'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const w = await prisma.webhookConfig.update({ where: { id: args.id }, data });
    return { ok: true, id: w.id, message: `已更新 Webhook ${w.name}` };
  },
};

export const deleteWebhook: ToolDefinition = {
  name: 'delete_webhook',
  description: '⚠️ 删除 Webhook 配置。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.webhookConfig.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除 Webhook' };
  },
};

// ========== 工作项模板 ==========
export const createTemplate: ToolDefinition = {
  name: 'create_template',
  description: '创建工作项模板。必填：name, workType。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      workType: { type: 'string', description: 'requirement/task/bug/release' },
      description: { type: 'string', description: '模板说明' },
      category: { type: 'string', description: '分类，默认"通用"' },
      defaultFields: { type: 'string', description: '预设字段 JSON' },
      childItems: { type: 'string', description: '子工作项模板 JSON' },
      tags: { type: 'string' },
    },
    required: ['name', 'workType'],
  },
  handler: async (args) => {
    const t = await prisma.workItemTemplate.create({
      data: {
        name: args.name, workType: args.workType,
        description: args.description || '',
        category: args.category || '通用',
        defaultFields: args.defaultFields || '{}',
        childItems: args.childItems || '[]',
        tags: args.tags || '',
      },
    });
    return { ok: true, id: t.id, name: t.name, message: `已创建模板 ${t.name}` };
  },
};

export const updateTemplate: ToolDefinition = {
  name: 'update_template',
  description: '更新工作项模板。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      defaultFields: { type: 'string' },
      childItems: { type: 'string' },
      tags: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'description', 'category', 'defaultFields', 'childItems', 'tags'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const t = await prisma.workItemTemplate.update({ where: { id: args.id }, data });
    return { ok: true, id: t.id, message: `已更新模板 ${t.name}` };
  },
};

export const deleteTemplate: ToolDefinition = {
  name: 'delete_template',
  description: '⚠️ 删除工作项模板。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.workItemTemplate.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除模板' };
  },
};

// ========== 公式字段 / 汇总字段 ==========
export const createFormulaField: ToolDefinition = {
  name: 'create_formula_field',
  description: '创建公式字段。必填：name, workType, fieldKey, formula。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      workType: { type: 'string', description: 'requirement/task/bug/release' },
      fieldKey: { type: 'string', description: '字段唯一标识' },
      formula: { type: 'string', description: '公式表达式' },
      outputType: { type: 'string', description: 'number/string/boolean/date' },
      description: { type: 'string' },
      spaceId: { type: 'string' },
    },
    required: ['name', 'workType', 'fieldKey', 'formula'],
  },
  handler: async (args) => {
    const f = await prisma.formulaField.create({
      data: {
        name: args.name, workType: args.workType, fieldKey: args.fieldKey,
        formula: args.formula,
        outputType: args.outputType || 'number', description: args.description || '',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: f.id, name: f.name, message: `已创建公式字段 ${f.name}` };
  },
};

export const updateFormulaField: ToolDefinition = {
  name: 'update_formula_field',
  description: '更新公式字段。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      formula: { type: 'string' },
      outputType: { type: 'string' },
      description: { type: 'string' },
      enabled: { type: 'boolean' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'formula', 'outputType', 'description', 'enabled'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const f = await prisma.formulaField.update({ where: { id: args.id }, data });
    return { ok: true, id: f.id, message: `已更新公式字段 ${f.name}` };
  },
};

export const deleteFormulaField: ToolDefinition = {
  name: 'delete_formula_field',
  description: '⚠️ 删除公式字段。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.formulaField.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除公式字段' };
  },
};

export const createRollupField: ToolDefinition = {
  name: 'create_rollup_field',
  description: '创建汇总字段。必填：name, workType, fieldKey, sourceField, aggregation。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      workType: { type: 'string', description: 'requirement/task/bug/release' },
      fieldKey: { type: 'string', description: '字段唯一标识' },
      childType: { type: 'string', description: '子工作项类型，默认 task' },
      sourceField: { type: 'string', description: '来源字段（如 estimate/actualHours）' },
      aggregation: { type: 'string', description: 'sum/count/avg/min/max' },
      description: { type: 'string' },
      spaceId: { type: 'string' },
    },
    required: ['name', 'workType', 'fieldKey', 'sourceField', 'aggregation'],
  },
  handler: async (args) => {
    const f = await prisma.rollupField.create({
      data: {
        name: args.name, workType: args.workType, fieldKey: args.fieldKey,
        childType: args.childType || 'task',
        sourceField: args.sourceField,
        aggregation: args.aggregation,
        description: args.description || '',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: f.id, name: f.name, message: `已创建汇总字段 ${f.name}` };
  },
};

export const updateRollupField: ToolDefinition = {
  name: 'update_rollup_field',
  description: '更新汇总字段。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      sourceField: { type: 'string' },
      aggregation: { type: 'string' },
      description: { type: 'string' },
      enabled: { type: 'boolean' },
    },
    required: ['id'],
  },
  handler: async (args) => {
    const data: any = {};
    ['name', 'sourceField', 'aggregation', 'description', 'enabled'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const f = await prisma.rollupField.update({ where: { id: args.id }, data });
    return { ok: true, id: f.id, message: `已更新汇总字段 ${f.name}` };
  },
};

export const deleteRollupField: ToolDefinition = {
  name: 'delete_rollup_field',
  description: '⚠️ 删除汇总字段。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.rollupField.delete({ where: { id: args.id } });
    return { ok: true, message: '已删除汇总字段' };
  },
};

// ========== 收藏 ==========
export const addFavorite: ToolDefinition = {
  name: 'add_favorite',
  description: '添加收藏。必填：userId, title, resourceType, resourceId。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      title: { type: 'string' },
      resourceType: { type: 'string', description: 'project/work_item/dashboard/space' },
      resourceId: { type: 'string', description: '资源 ID' },
      link: { type: 'string', description: '链接路径' },
      folder: { type: 'string', description: '收藏夹名称' },
      spaceId: { type: 'string' },
    },
    required: ['userId', 'title', 'resourceType', 'resourceId'],
  },
  handler: async (args) => {
    const f = await prisma.favorite.create({
      data: {
        userId: args.userId, title: args.title, resourceType: args.resourceType,
        resourceId: args.resourceId,
        link: args.link || '', folder: args.folder || '默认',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: f.id, message: `已收藏 ${f.title}` };
  },
};

export const removeFavorite: ToolDefinition = {
  name: 'remove_favorite',
  description: '取消收藏。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.favorite.delete({ where: { id: args.id } });
    return { ok: true, message: '已取消收藏' };
  },
};

// ========== 工作交接 ==========
export const createWorkHandover: ToolDefinition = {
  name: 'create_work_handover',
  description: '创建工作交接单。必填：fromUserName, toUserName。',
  parameters: {
    type: 'object',
    properties: {
      fromUserName: { type: 'string', description: '交接人姓名' },
      toUserName: { type: 'string', description: '接交人姓名' },
      reason: { type: 'string', description: '交接原因' },
      workItemKeys: { type: 'array', items: { type: 'string' }, description: '要交接的工作项 Key 列表（如 REQ-1, TASK-2）' },
      spaceId: { type: 'string' },
    },
    required: ['fromUserName', 'toUserName'],
  },
  handler: async (args) => {
    let fromUserId = '', toUserId = '';
    const fromUser = await prisma.user.findFirst({ where: { OR: [{ username: args.fromUserName }, { displayName: args.fromUserName }] } });
    if (fromUser) { fromUserId = fromUser.id; }
    const toUser = await prisma.user.findFirst({ where: { OR: [{ username: args.toUserName }, { displayName: args.toUserName }] } });
    if (toUser) { toUserId = toUser.id; }
    if (!fromUserId || !toUserId) throw new Error('交接人或接交人不存在');
    const wids: string[] = [];
    if (args.workItemKeys) {
      for (const key of args.workItemKeys) {
        const w = await prisma.workItem.findUnique({ where: { key } });
        if (w) wids.push(w.id);
      }
    }
    const h = await prisma.workHandover.create({
      data: {
        fromUserId, fromUserName: args.fromUserName,
        toUserId, toUserName: args.toUserName,
        reason: args.reason || '', workItemIds: JSON.stringify(wids),
        status: 'pending',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: h.id, message: `已创建交接单：${args.fromUserName} → ${args.toUserName}` };
  },
};

export const completeWorkHandover: ToolDefinition = {
  name: 'complete_work_handover',
  description: '完成工作交接（将工作项负责人改为接交人）。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const h = await prisma.workHandover.findUnique({ where: { id: args.id } });
    if (!h) throw new Error('交接单不存在');
    let wids: string[] = [];
    try { wids = JSON.parse(h.workItemIds); } catch { /* ignore */ }
    for (const wid of wids) {
      await prisma.workItem.update({ where: { id: wid }, data: { assignee: h.toUserName } }).catch(() => {/* ignore */});
    }
    await prisma.workHandover.update({
      where: { id: args.id },
      data: { status: 'done' },
    });
    return { ok: true, message: '交接已完成，工作项负责人已更新' };
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

// ========== 通知 ==========
export const createNotification: ToolDefinition = {
  name: 'create_notification',
  description: '发送系统通知给用户。必填：recipientId, title, content。',
  parameters: {
    type: 'object',
    properties: {
      recipientId: { type: 'string', description: '接收人用户 ID' },
      recipientName: { type: 'string', description: '接收人用户名（与 recipientId 二选一）' },
      title: { type: 'string' },
      content: { type: 'string' },
      level: { type: 'string', description: 'info/warning/error/success' },
      type: { type: 'string', description: '通知类型' },
      link: { type: 'string', description: '点击跳转链接' },
    },
    required: ['title', 'content'],
  },
  handler: async (args) => {
    let recipientId = args.recipientId;
    if (!recipientId && args.recipientName) {
      const u = await prisma.user.findFirst({ where: { OR: [{ username: args.recipientName }, { displayName: args.recipientName }] } });
      if (!u) throw new Error(`用户 ${args.recipientName} 不存在`);
      recipientId = u.id;
    }
    if (!recipientId) throw new Error('必须提供 recipientId 或 recipientName');
    const n = await prisma.notification.create({
      data: {
        recipientId, title: args.title, content: args.content,
        level: args.level || 'info', type: args.type || 'system',
        link: args.link || '',
      },
    });
    // 尝试通过 WebSocket 推送
    try {
      const { pushToUser } = await import('./wsServer');
      pushToUser(recipientId, { type: 'notification', data: n });
    } catch {/* ignore if WS not initialized */}
    return { ok: true, id: n.id, message: `已发送通知: ${args.title}` };
  },
};

// 汇总导出：所有工具（查询 + 写入）
export const QUERY_TOOLS: ToolDefinition[] = [
  // 查询工具 (43个)
  getWorkItem, listUsers, listSpaces, getCustomer, listCarModels, getCarModel,
  listIterations, listFlows, getFlow, listReviews, getReview, listActivities,
  listDashboards, listCharts, getDashboard, listTestCases, listTestPlans, listTestRuns, getTestRun,
  listAuditLogs, listAutomationRules, listBaselines, listResourceAllocations, listImportJobs,
  listSpaceMembers, getTenant, listWebhooks, listTemplates, listFormulaFields, listRollupFields,
  listAIReports, listFavorites, listWorkHandovers, getExternalDependency, getWorkbench,
  listLLMSettings, listResourceAnalyses, listAutomationLogs, listWebhookLogs,
  listSSOSettings, listSSOLogs, getWorkbenchConfig,
  // 删除工具 (7个)
  deleteCustomer, deleteCarModel, deleteContact, deleteIteration, deleteFlow, deleteComment,
  // 空间管理 (4个)
  createSpace, updateSpace, addSpaceMember, removeSpaceMember,
  // 用户管理 (3个)
  createUser, updateUser, resetUserPassword,
  // 外部依赖 (3个)
  createExternalDependency, updateExternalDependency, deleteExternalDependency,
  // 评审 (2个)
  createReview, finalizeReview,
  // 测试用例/计划/执行 (4个)
  createTestCase, updateTestCase, createTestPlan, createTestRun,
  // 自动化规则 (4个)
  createAutomationRule, updateAutomationRule, deleteAutomationRule, toggleAutomationRule,
  // Webhook (3个)
  createWebhook, updateWebhook, deleteWebhook,
  // 模板 (3个)
  createTemplate, updateTemplate, deleteTemplate,
  // 公式/聚合字段 (6个)
  createFormulaField, updateFormulaField, deleteFormulaField,
  createRollupField, updateRollupField, deleteRollupField,
  // 收藏 (2个)
  addFavorite, removeFavorite,
  // 工作交接 (2个)
  createWorkHandover, completeWorkHandover,
  // 基线 (1个)
  createBaseline,
  // 资源分配 (3个)
  createResourceAllocation, updateResourceAllocation, deleteResourceAllocation,
  // 仪表盘/图表 (6个)
  createDashboard, updateDashboard, deleteDashboard,
  createChart, updateChart, deleteChart,
  // 工作项关系 (2个)
  addWorkItemRelation, removeWorkItemRelation,
  // 通知 (1个)
  createNotification,
];
