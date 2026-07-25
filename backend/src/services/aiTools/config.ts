/**
 * AI 工具 - 配置类
 * 自动化/Webhook/模板/字段
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

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

