/**
 * MCP Server 核心 - 工具/资源/提示词定义与执行 (V1.47 重构)
 *
 * 重构说明：
 *   - 不再硬编码 13 个工具，改为从 [[aiTools]] 全量桥接 124 个工具
 *     （9 核心 + 18 扩展 + 97 QUERY_TOOLS）
 *   - executeTool 增加用户上下文 (ctx)，支持 HTTP 模式注入 req.user
 *   - stdio 模式通过环境变量 AVM_MCP_TOKEN 传入 JWT
 *   - 同时被 HTTP 路由（routes/mcp.ts）和 stdio 入口（bin/mcp-stdio.ts）使用
 */
import { prisma } from '../db';
import { TYPE_PREFIX } from '../constants';
import { TOOLS as AI_TOOLS, executeTool as executeAiTool } from './aiTools';
import type { ToolDefinition } from './aiTools/types';

// ========== 用户上下文 ==========
export interface McpUserContext {
  userId?: string;
  tenantId?: string;
  role?: string;
  username?: string;
  spaceId?: string;
  /** 是否为 stdio 模式（无 HTTP 上下文） */
  stdio?: boolean;
}

// ========== 旧版 13 个工具的元数据保留（供 listResources/prompts 引用） ==========
// 这些工具已合并到 AI_TOOLS 中（list_work_items/get_work_item/create_work_item/
// update_work_item/add_comment/search/get_metrics/get_team_workload/analyze_resources/
// trigger_automation/ai_qa/ai_estimate/ai_classify_bug 在 aiTools.ts 或 aiToolsExt.ts 中实现）

// ========== 工具桥接适配器 ==========
/**
 * 把 ToolDefinition 转成 MCP tool schema 格式
 * ToolDefinition.parameters → MCP inputSchema
 */
function toolDefinitionToMcp(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
  };
}

/**
 * 动态生成 MCP 工具列表（从 AI_TOOLS 全量桥接）
 */
function buildMcpTools() {
  return AI_TOOLS.map(toolDefinitionToMcp);
}

// 缓存工具列表（AI_TOOLS 在运行时是静态的，构建一次即可）
let _cachedTools: ReturnType<typeof buildMcpTools> | null = null;
function getMcpTools() {
  if (!_cachedTools) _cachedTools = buildMcpTools();
  return _cachedTools;
}

// 旧导出保留向后兼容（routes/mcp.ts 使用）
export const MCP_TOOLS = getMcpTools();

// ========== 工具执行分发器 ==========
/**
 * 执行 MCP 工具
 * V1.47: 委托给 aiTools.ts 的 executeTool（统一工具执行入口）
 *
 * @param name 工具名（snake_case）
 * @param args 工具参数
 * @param ctx 用户上下文（V1.47 新增，用于后续权限校验）
 */
export async function executeTool(name: string, args: any, ctx?: McpUserContext): Promise<any> {
  // 先查 AI_TOOLS 中的工具（124 个）
  const aiTool = AI_TOOLS.find(t => t.name === name);
  if (aiTool) {
    // 注入 ctx 到 args（供工具内部使用，当前工具实现未读取，后续可逐步接入）
    // 这里采用"显式传递"而非"全局变量"，便于后续审计
    const enrichedArgs = ctx ? { ...args, _ctx: ctx } : args;
    return await executeAiTool(name, enrichedArgs);
  }

  // 旧版 13 个工具中有些不在 AI_TOOLS 里（如 get_metrics / get_team_workload /
  // analyze_resources / trigger_automation / ai_qa / ai_estimate / ai_classify_bug），
  // 这些保留原 mcpCore 的实现作为 fallback
  switch (name) {
    case 'get_metrics': {
      const [total, byType, byStatus, byPriority, overdue, dueSoon] = await Promise.all([
        prisma.workItem.count(),
        prisma.workItem.groupBy({ by: ['type'], _count: { _all: true } }),
        prisma.workItem.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.workItem.groupBy({ by: ['priority'], _count: { _all: true } }),
        prisma.workItem.count({ where: { planEnd: { lt: new Date() }, status: { notIn: ['已完成', '已关闭'] } } }),
        prisma.workItem.count({ where: { planEnd: { gte: new Date(), lte: new Date(Date.now() + 3 * 86400000) }, status: { notIn: ['已完成', '已关闭'] } } }),
      ]);
      return { total, byType, byStatus, byPriority, overdue, dueSoon };
    }
    case 'get_team_workload': {
      const users = await prisma.user.findMany({ where: { active: true } });
      return Promise.all(users.map(async u => {
        const [active, completed] = await Promise.all([
          prisma.workItem.count({ where: { assignee: { in: [u.username, u.displayName] }, status: { notIn: ['已完成', '已关闭'] } } }),
          prisma.workItem.count({ where: { assignee: { in: [u.username, u.displayName] }, status: '已完成' } }),
        ]);
        return { userId: u.username, displayName: u.displayName, active, completed };
      }));
    }
    case 'analyze_resources': {
      const { analyzeResources } = await import('./resourceAnalysisEngine');
      return analyzeResources(args.startDate, args.endDate);
    }
    case 'trigger_automation': {
      const rule = await prisma.automationRule.findUnique({ where: { id: args.ruleId } });
      if (!rule) throw new Error('Rule not found');
      const { runAutomation } = await import('./automationEngine');
      return runAutomation(rule, args.context || {});
    }
    case 'ai_qa': {
      const { smartQA } = await import('./aiEngine');
      return smartQA(args.question);
    }
    case 'ai_estimate': {
      const { suggestEstimate } = await import('./aiEngine');
      return suggestEstimate({ type: args.type, title: args.title, description: args.description, module: args.module });
    }
    case 'ai_classify_bug': {
      const { classifyBug } = await import('./aiEngine');
      return classifyBug({ title: args.title, description: args.description });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ========== 资源（保留原样） ==========
export async function listResources() {
  const items = await prisma.workItem.findMany({
    take: 50, orderBy: { updatedAt: 'desc' },
    select: { id: true, key: true, title: true, type: true, status: true, priority: true, assignee: true, updatedAt: true },
  });
  return items.map(i => ({
    uri: `avm://work-item/${i.id}`,
    name: `${i.key} ${i.title}`,
    description: `${i.type} · ${i.status} · ${i.priority}${i.assignee ? ' · @' + i.assignee : ''}`,
    mimeType: 'application/json',
  }));
}

export async function readResource(uri: string) {
  const m = uri.match(/^avm:\/\/work-item\/(.+)$/);
  if (!m) throw new Error('Unsupported URI scheme');
  const item = await prisma.workItem.findUnique({
    where: { id: m[1] },
    include: { comments: true, children: { select: { id: true, key: true, title: true, status: true } } },
  });
  if (!item) throw new Error('Resource not found');
  return { uri, mimeType: 'application/json', content: item };
}

// ========== JSON-RPC 2.0 共用处理器 ==========
/**
 * stdio 模式（mcp-stdio.ts）+ HTTP+SSE 模式（routes/mcp.ts /stream）都调这个
 * 返回 { response: JsonRpcResponse | null, isError?: boolean, rawResult?: any }
 *   - response: 给客户端的 JSON-RPC 响应（成功/错误）；null 表示通知（无 id 不返回）
 *   - toolResult: 工具调用的 content 包装（用于 SSE 序列化）
 *
 * V1.47: handleJsonRpcRequest 增加可选 ctx 参数，工具执行时传递
 */
export interface JsonRpcRequest { jsonrpc?: string; id?: number | string; method: string; params?: any }
export interface JsonRpcResponse { jsonrpc: '2.0'; id: number | string; result?: any; error?: { code: number; message: string; data?: any } }

export const SERVER_INFO = {
  name: 'avm-mcp-server',
  version: '1.47.0',
  protocolVersion: '2024-11-05',
};

export const CAPABILITIES = {
  tools: { listChanged: false },
  resources: { subscribe: false, listChanged: false },
  prompts: { listChanged: false },
};

function toolResultContent(content: any, isError = false) {
  return {
    content: [
      { type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) },
    ],
    isError,
  };
}

/** 统一处理一个 JSON-RPC 请求，返回响应对象（id 是 undefined 时返回 null） */
export async function handleJsonRpcRequest(req: JsonRpcRequest, ctx?: McpUserContext): Promise<JsonRpcResponse | null> {
  const { id, method, params } = req;
  const isNotification = id === undefined;

  const respond = (result: any): JsonRpcResponse => ({ jsonrpc: '2.0', id: id!, result });
  const respondError = (code: number, message: string, data?: any): JsonRpcResponse => ({ jsonrpc: '2.0', id: id!, error: { code, message, data } });

  try {
    switch (method) {
      case 'initialize':
        if (isNotification) return null;
        return respond({
          protocolVersion: SERVER_INFO.protocolVersion,
          serverInfo: { ...SERVER_INFO, toolsCount: getMcpTools().length },
          capabilities: CAPABILITIES,
        });

      case 'ping':
        if (isNotification) return null;
        return respond({});

      case 'tools/list':
        if (isNotification) return null;
        return respond({ tools: getMcpTools() });

      case 'tools/call': {
        const { name, arguments: args = {} } = params || {};
        const tool = getMcpTools().find(t => t.name === name);
        if (!tool) {
          if (isNotification) return null;
          return respond(toolResultContent(`Tool not found: ${name}`, true));
        }
        try {
          const result = await executeTool(name, args, ctx);
          if (isNotification) return null;
          return respond(toolResultContent(result));
        } catch (e: any) {
          if (isNotification) return null;
          return respond(toolResultContent({ error: e.message }, true));
        }
      }

      case 'resources/list':
        if (isNotification) return null;
        return respond({ resources: await listResources() });

      case 'resources/read': {
        const { uri } = params || {};
        try {
          const data = await readResource(uri);
          if (isNotification) return null;
          return respond({
            contents: [
              { uri, mimeType: data.mimeType, text: JSON.stringify(data.content, null, 2) },
            ],
          });
        } catch (e: any) {
          if (isNotification) return null;
          return respondError(-32002, e.message);
        }
      }

      case 'prompts/list':
        if (isNotification) return null;
        return respond({
          prompts: PROMPT_TEMPLATES.map(t => ({
            name: t.id,
            description: t.description,
            arguments: [],
          })),
        });

      case 'prompts/get': {
        const { name } = params || {};
        const tpl = PROMPT_TEMPLATES.find(t => t.id === name);
        if (!tpl) {
          if (isNotification) return null;
          return respondError(-32002, `Prompt not found: ${name}`);
        }
        if (isNotification) return null;
        return respond({
          description: tpl.description,
          messages: [
            { role: 'user', content: { type: 'text', text: tpl.template } },
          ],
        });
      }

      default:
        if (isNotification) return null;
        return respondError(-32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    if (isNotification) return null;
    return respondError(-32603, e.message || 'Internal error');
  }
}

export const PROMPT_TEMPLATES = [
  {
    id: 'daily-standup',
    name: '每日站会',
    description: '基于当前数据生成每日站会报告',
    template: `基于 AVM 当前数据：
- 调用 get_team_workload 了解团队分工
- 调用 get_metrics 了解项目状态
- 调用 ai_qa("超期的工作项有哪些？") 找出风险
生成简洁的每日站会报告。`,
  },
  {
    id: 'sprint-review',
    name: '迭代回顾',
    description: '基于当前迭代数据生成回顾报告',
    template: `回顾本次迭代：
- 调用 list_work_items(type=task, iterationId=...) 获取所有任务
- 调用 analyze_resources(startDate, endDate) 评估人力
- 调用 search("超期") 找超期项
生成本迭代的回顾报告。`,
  },
  {
    id: 'risk-assessment',
    name: '风险评估',
    description: '评估当前项目风险',
    template: `执行项目风险评估：
- 调用 get_metrics 看临期/超期
- 调用 analyze_resources 看人力过载
- 调用 search("P0") 找紧急项
- 调用 ai_qa("状态分布") 看健康度
输出风险清单和缓解建议。`,
  },
  {
    id: 'new-dev-onboarding',
    name: '新人入职',
    description: '为新成员生成项目概览',
    template: `为新成员生成项目入门指南：
- 调用 get_metrics 了解项目规模
- 调用 list_work_items(type=requirement, status=已规划) 了解待开发需求
- 调用 get_team_workload 了解团队
- 搜索 "架构" / "设计" 找核心文档
生成 5 分钟阅读的入门指南。`,
  },
];
