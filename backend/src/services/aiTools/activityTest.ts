/**
 * AI 工具 - 活动与测试
 * 活动记录 + 测试用例/计划/执行
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

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

