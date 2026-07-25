/**
 * AI 工具 - AI 设置与报告
 * LLM 配置 + AI 报告
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

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

