/**
 * Agent 命令注册系统 (V1.44)
 *
 * 参照 Trae Work Agent 模式：
 * - 用户输入 / 触发命令菜单
 * - 每个命令是一个可执行的 Agent 工作流
 * - 命令可带参数，支持自然语言补全
 * - 插件式架构，新命令只需注册即可
 */

import { prisma } from '../db';
import { getLLMProvider } from './llmProvider';
import { buildProjectSnapshot } from './projectSnapshot';
import { loadWikiKnowledge } from './wikiKnowledge';
import { toolsToOpenAIFormat, executeTool } from './aiTools';
import { recordAudit, actorFromReq } from '../utils/audit';
import { TYPE_PREFIX } from '../constants';

// ============================================================
// 命令类型定义
// ============================================================

export interface AgentCommandParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'date' | 'user';
  description: string;
  required?: boolean;
  options?: string[];          // select 类型用
  default?: any;
}

export interface AgentCommand {
  name: string;                // 命令名（如 create-work-item）
  alias?: string[];            // 别名（如 ['新建', '创建']）
  description: string;         // 简短描述
  category: 'work' | 'project' | 'analysis' | 'report' | 'admin' | 'ai';
  params: AgentCommandParam[];
  hint?: string;               // 参数输入提示
  execute: (args: Record<string, any>, ctx: CommandContext) => Promise<CommandResult>;
}

export interface CommandContext {
  userId?: string;
  username?: string;
  role?: string;
}

export interface CommandResult {
  ok: boolean;
  title: string;               // 结果标题
  content: string;             // Markdown 内容
  data?: any;                  // 结构化数据（前端可渲染）
  actions?: CommandAction[];   // 后续可执行操作
}

export interface CommandAction {
  label: string;
  command: string;             // 关联的命令名
  args?: Record<string, any>;
}

// ============================================================
// 命令注册表
// ============================================================

const commandRegistry = new Map<string, AgentCommand>();

export function registerCommand(cmd: AgentCommand): void {
  commandRegistry.set(cmd.name, cmd);
  if (cmd.alias) {
    for (const a of cmd.alias) {
      commandRegistry.set(a, cmd);
    }
  }
}

export function getCommand(name: string): AgentCommand | undefined {
  return commandRegistry.get(name);
}

export function listCommands(category?: string): AgentCommand[] {
  const seen = new Set<string>();
  const result: AgentCommand[] = [];
  for (const cmd of commandRegistry.values()) {
    if (seen.has(cmd.name)) continue;
    seen.add(cmd.name);
    if (category && cmd.category !== category) continue;
    result.push(cmd);
  }
  return result;
}

export function searchCommands(query: string): AgentCommand[] {
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const result: AgentCommand[] = [];
  for (const cmd of commandRegistry.values()) {
    if (seen.has(cmd.name)) continue;
    seen.add(cmd.name);
    const matchName = cmd.name.toLowerCase().includes(q);
    const matchDesc = cmd.description.toLowerCase().includes(q);
    const matchAlias = cmd.alias?.some(a => a.toLowerCase().includes(q));
    if (matchName || matchDesc || matchAlias) {
      result.push(cmd);
    }
  }
  return result;
}

// ============================================================
// 核心命令实现
// ============================================================

// --- 工作项 ---
registerCommand({
  name: 'create-work-item',
  alias: ['新建工作项', '创建任务', '新建bug', '新建需求'],
  description: '创建新的工作项（需求/任务/Bug/发布）',
  category: 'work',
  params: [
    { name: 'title', type: 'string', description: '标题', required: true },
    { name: 'type', type: 'select', description: '类型', options: ['requirement', 'task', 'bug', 'release'], default: 'task' },
    { name: 'priority', type: 'select', description: '优先级', options: ['P0', 'P1', 'P2', 'P3'], default: 'P2' },
    { name: 'description', type: 'string', description: '描述' },
    { name: 'assignee', type: 'string', description: '负责人' },
    { name: 'projectCode', type: 'string', description: '关联项目编码' },
  ],
  hint: '/create-work-item 标题 [类型] [优先级]',
  execute: async (args, ctx) => {
    const { title, type = 'task', priority = 'P2', description = '', assignee = '', projectCode } = args;
    if (!title) return { ok: false, title: '创建失败', content: '标题必填' };

    // 解析 projectCode → projectId
    let projectId: string | null = null;
    if (projectCode) {
      const p = await prisma.project.findUnique({ where: { code: projectCode } });
      if (p) projectId = p.id;
    }

    const prefix = TYPE_PREFIX[type] || 'TASK';
    const count = await prisma.workItem.count({ where: { type } });
    const key = `${prefix}-${count + 1}`;

    const item = await prisma.workItem.create({
      data: {
        key, type, title, description, priority,
        status: '待领取',
        assignee: assignee || null,
        reporter: ctx.username || 'AI 助理',
        projectId,
      },
    });

    recordAudit('workItem', item.id, 'create', null, { method: 'agent', command: 'create-work-item' }, { username: ctx.username || 'ai-agent', role: ctx.role || 'member' });

    return {
      ok: true,
      title: `已创建 ${item.key}`,
      content: `**${item.key}** ${item.title}\n- 类型: ${type}\n- 优先级: ${priority}\n- 状态: 待领取${assignee ? `\n- 负责人: ${assignee}` : ''}${projectCode ? `\n- 项目: ${projectCode}` : ''}`,
      data: item,
      actions: [
        { label: '分配负责人', command: 'suggest-assignee', args: { title } },
        { label: '拆解子任务', command: 'decompose', args: { workItemId: item.id } },
      ],
    };
  },
});

// --- 项目分析 ---
registerCommand({
  name: 'analyze-project',
  alias: ['项目分析', '分析项目', '项目健康度'],
  description: '分析指定项目的整体健康度、风险和工作项分布',
  category: 'analysis',
  params: [
    { name: 'projectCode', type: 'string', description: '项目编码（不填则分析全部）' },
  ],
  hint: '/analyze-project [项目编码]',
  execute: async (args) => {
    const { projectCode } = args;
    const where: any = {};
    if (projectCode) where.code = projectCode;

    const projects = await prisma.project.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        carModel: { select: { name: true } },
        _count: { select: { workItems: true } },
      },
    });

    if (projects.length === 0) {
      return { ok: false, title: '未找到项目', content: projectCode ? `项目 ${projectCode} 不存在` : '暂无项目数据' };
    }

    const today = new Date();
    const lines: string[] = [];
    lines.push(`## 项目概览`);
    lines.push(`共 **${projects.length}** 个项目`);
    lines.push('');

    for (const p of projects) {
      const daysLeft = Math.ceil((new Date(p.endDate).getTime() - today.getTime()) / 86400000);
      const riskEmoji = p.risk === 'high' ? '🔴' : p.risk === 'medium' ? '' : '🟢';
      lines.push(`### ${p.code} ${p.name}`);
      lines.push(`- 状态: ${p.status} | 进度: ${p.progress || 0}% | 风险: ${riskEmoji} ${p.risk || '未知'}`);
      lines.push(`- 客户: ${p.customer?.name || '-'} | 车型: ${p.carModel?.name || '-'}`);
      lines.push(`- 工作项: ${p._count.workItems} 个 | 剩余: ${daysLeft > 0 ? daysLeft + ' 天' : '⚠️ 已超期 ' + Math.abs(daysLeft) + ' 天'}`);
      lines.push('');
    }

    // 统计
    const highRisk = projects.filter(p => p.risk === 'high').length;
    const overdue = projects.filter(p => new Date(p.endDate) < today).length;

    return {
      ok: true,
      title: `项目分析 (${projects.length} 个)`,
      content: lines.join('\n') + `\n**汇总**: 高风险 ${highRisk} 个 | 超期 ${overdue} 个`,
      data: { projects, highRisk, overdue },
      actions: [
        { label: '风险扫描', command: 'risk-scan' },
        { label: '生成周报', command: 'weekly-report' },
      ],
    };
  },
});

// --- 风险扫描 ---
registerCommand({
  name: 'risk-scan',
  alias: ['风险扫描', '扫描风险', '检查风险'],
  description: '扫描所有项目的风险项（超期/P0P1/预算）',
  category: 'analysis',
  params: [],
  hint: '/risk-scan',
  execute: async () => {
    const today = new Date();
    const projects = await prisma.project.findMany({
      include: { customer: { select: { name: true } } },
    });

    const risks: string[] = [];
    let riskCount = 0;

    for (const p of projects) {
      const daysLeft = Math.ceil((new Date(p.endDate).getTime() - today.getTime()) / 86400000);
      if (p.risk === 'high') {
        risks.push(`🔴 **${p.code}** ${p.name} - 高风险 (进度 ${p.progress || 0}%)`);
        riskCount++;
      }
      if (daysLeft < 0) {
        risks.push(`⚠️ **${p.code}** ${p.name} - 已超期 ${Math.abs(daysLeft)} 天`);
        riskCount++;
      }
      if (daysLeft <= 7 && daysLeft >= 0) {
        risks.push(`🟡 **${p.code}** ${p.name} - 即将到期 (${daysLeft} 天)`);
        riskCount++;
      }
    }

    // P0/P1 未完成
    const criticalItems = await prisma.workItem.findMany({
      where: {
        priority: { in: ['P0', 'P1'] },
        status: { notIn: ['已完成', '已关闭', '已驳回', '已发布', '已验收'] },
      },
      take: 20,
      select: { key: true, title: true, priority: true, assignee: true, status: true },
    });

    if (criticalItems.length > 0) {
      risks.push(`\n**P0/P1 紧急未完成 (${criticalItems.length} 项)**:`);
      for (const i of criticalItems) {
        risks.push(`- 🚨 ${i.key} ${i.title} (${i.priority}, ${i.assignee || '未指派'})`);
      }
    }

    return {
      ok: true,
      title: `风险扫描完成 (${riskCount + criticalItems.length} 项)`,
      content: risks.length > 0 ? risks.join('\n') : '🎉 暂无风险项',
      data: { riskCount, criticalCount: criticalItems.length },
      actions: [
        { label: '生成风险报告', command: 'weekly-report' },
        { label: '查看项目详情', command: 'analyze-project' },
      ],
    };
  },
});

// --- 周报生成 ---
registerCommand({
  name: 'weekly-report',
  alias: ['周报', '生成周报', '周报告'],
  description: '生成项目周报（含进度/风险/活动/完成项）',
  category: 'report',
  params: [
    { name: 'period', type: 'select', description: '周期', options: ['week', 'month', 'quarter'], default: 'week' },
    { name: 'user', type: 'string', description: '指定用户（不填则全部）' },
    { name: 'projectCode', type: 'string', description: '指定项目' },
  ],
  hint: '/weekly-report [week|month|quarter]',
  execute: async (args) => {
    const { period = 'week', user, projectCode } = args;
    const daysMap: Record<string, number> = { week: 7, month: 30, quarter: 90 };
    const days = daysMap[period] || 7;
    const start = new Date(Date.now() - days * 86400000);
    const end = new Date();

    const projects = await prisma.project.findMany({
      include: { customer: { select: { name: true } }, carModel: { select: { name: true } }, _count: { select: { workItems: true } } },
    });

    const newItems = await prisma.workItem.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' }, take: 20,
    });
    const completedItems = await prisma.workItem.findMany({
      where: { actualEnd: { gte: start } },
      orderBy: { actualEnd: 'desc' }, take: 20,
    });
    const criticalItems = await prisma.workItem.findMany({
      where: { priority: { in: ['P0', 'P1'] }, status: { notIn: ['已完成', '已关闭', '已驳回', '已发布', '已验收'] } },
      take: 15,
    });

    const lines: string[] = [];
    const periodLabel = period === 'week' ? '本周' : period === 'month' ? '本月' : '本季度';
    lines.push(`# AVM 项目${periodLabel}报告`);
    lines.push(`> 周期: ${start.toISOString().slice(0, 10)} ~ ${end.toISOString().slice(0, 10)}`);
    lines.push('');
    lines.push(`## 概览`);
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 项目总数 | ${projects.length} |`);
    lines.push(`| 新增工作项 | ${newItems.length} |`);
    lines.push(`| 完成工作项 | ${completedItems.length} |`);
    lines.push(`| P0/P1 紧急 | ${criticalItems.length} |`);
    lines.push('');

    if (completedItems.length > 0) {
      lines.push('## 本期完成');
      for (const i of completedItems) {
        lines.push(`- ✅ **${i.key}** ${i.title} (${i.assignee || '-'})`);
      }
      lines.push('');
    }

    if (criticalItems.length > 0) {
      lines.push('## 紧急待办');
      for (const i of criticalItems) {
        lines.push(`- 🚨 **${i.key}** ${i.title} (${i.priority}, ${i.assignee || '-'})`);
      }
      lines.push('');
    }

    return {
      ok: true,
      title: `${periodLabel}报告`,
      content: lines.join('\n'),
      data: { period, projectCount: projects.length, newItemCount: newItems.length, completedItemCount: completedItems.length, criticalItemCount: criticalItems.length },
      actions: [
        { label: '风险扫描', command: 'risk-scan' },
        { label: '项目分析', command: 'analyze-project' },
      ],
    };
  },
});

// --- 负责人推荐 ---
registerCommand({
  name: 'suggest-assignee',
  alias: ['推荐负责人', '分配建议', '谁来负责'],
  description: '基于负载和角色智能推荐工作项负责人',
  category: 'ai',
  params: [
    { name: 'title', type: 'string', description: '工作项标题', required: true },
    { name: 'type', type: 'select', description: '类型', options: ['requirement', 'task', 'bug', 'release'] },
    { name: 'priority', type: 'select', description: '优先级', options: ['P0', 'P1', 'P2', 'P3'] },
  ],
  hint: '/suggest-assignee 工作项标题',
  execute: async (args) => {
    const { title, type, priority } = args;
    const users = await prisma.user.findMany({ select: { displayName: true, role: true, department: true } });
    const since = new Date(Date.now() - 30 * 86400000);
    const items = await prisma.workItem.findMany({
      where: { createdAt: { gte: since } },
      select: { assignee: true, status: true, priority: true },
    });

    const userLoad: Record<string, number> = {};
    for (const i of items) {
      if (!i.assignee) continue;
      if (!['已完成', '已关闭', '已驳回', '已发布', '已验收'].includes(i.status)) {
        userLoad[i.assignee] = (userLoad[i.assignee] || 0) + 1;
      }
    }

    // 找负载最低的用户
    let bestUser = users[0];
    let minLoad = Infinity;
    for (const u of users) {
      const load = userLoad[u.displayName] || 0;
      if (load < minLoad) {
        minLoad = load;
        bestUser = u;
      }
    }

    return {
      ok: true,
      title: `推荐负责人: ${bestUser?.displayName || '未知'}`,
      content: `**推荐**: ${bestUser?.displayName} (${bestUser?.role}, ${bestUser?.department || '未填部门'})\n\n**理由**: 当前负载最低 (${minLoad} 个进行中任务)\n\n**工作项**: ${title}${type ? ` [${type}]` : ''}${priority ? ` [${priority}]` : ''}`,
      data: { assignee: bestUser?.displayName, load: minLoad },
      actions: [
        { label: '创建工作项并分配', command: 'create-work-item', args: { title, type, priority, assignee: bestUser?.displayName } },
      ],
    };
  },
});

// --- 工作项拆解 ---
registerCommand({
  name: 'decompose',
  alias: ['拆解', '拆子任务', '分解任务'],
  description: '将工作项拆解为可执行的子任务',
  category: 'ai',
  params: [
    { name: 'workItemId', type: 'string', description: '工作项 ID', required: true },
  ],
  hint: '/decompose 工作项ID',
  execute: async (args) => {
    const { workItemId } = args;
    const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
    if (!item) return { ok: false, title: '未找到工作项', content: `ID ${workItemId} 不存在` };

    const provider = await getLLMProvider();
    if (!provider.isAvailable() || provider.name === 'mock') {
      // 模板化拆解
      const templates: Record<string, string[]> = {
        requirement: ['需求评审与确认', '技术方案设计', '核心功能开发', '单元测试+集成测试', '联调+UAT'],
        task: ['任务拆解与排期', '代码实现', '自测+Code Review'],
        bug: ['复现与根因分析', '修复方案实施', '回归测试'],
      };
      const steps = templates[item.type] || ['计划与拆解', '执行', '验收'];
      return {
        ok: true,
        title: `拆解 ${item.key} (模板模式)`,
        content: `**${item.key}** ${item.title}\n\n子任务:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n> LLM 未配置，使用模板拆解。配置 LLM 后可获得更智能的拆解方案。`,
        data: { subtasks: steps.map(s => ({ title: `${item.title} - ${s}`, type: 'task' })) },
      };
    }

    const prompt = `将以下工作项拆成 3-8 个子任务，返回 JSON 数组：
- 标题: ${item.title}
- 描述: ${item.description || '(无)'}
- 类型: ${item.type}

[{"title": "...", "type": "task|bug", "priority": "P0|P1|P2|P3", "estimate": 数字(小时)}]`;

    const r = await provider.chat([
      { role: 'system', content: '你是项目拆解专家，只返回 JSON 数组。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 1500 });

    let subtasks: any[] = [];
    try {
      let content = r.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) subtasks = JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }

    return {
      ok: true,
      title: `拆解 ${item.key} (${subtasks.length} 个子任务)`,
      content: `**${item.key}** ${item.title}\n\n${subtasks.map((s: any, i: number) => `${i + 1}. **${s.title}** [${s.type || 'task'}] ${s.priority || 'P2'} ${s.estimate ? s.estimate + 'h' : ''}`).join('\n')}`,
      data: { subtasks, parent: { id: item.id, key: item.key, title: item.title } },
      actions: subtasks.map((s: any) => ({ label: `创建: ${s.title}`, command: 'create-work-item', args: { title: s.title, type: s.type || 'task', priority: s.priority || 'P2' } })),
    };
  },
});

// --- 仪表盘 ---
registerCommand({
  name: 'dashboard',
  alias: ['仪表盘', '数据看板', '概览'],
  description: '生成项目中心数据概览仪表盘',
  category: 'analysis',
  params: [],
  hint: '/dashboard',
  execute: async () => {
    const [projectCount, workItemCount, userCount, iterationCount] = await Promise.all([
      prisma.project.count(),
      prisma.workItem.count(),
      prisma.user.count(),
      prisma.iteration.count(),
    ]);

    const statusDist = await prisma.workItem.groupBy({ by: ['status'], _count: true });
    const typeDist = await prisma.workItem.groupBy({ by: ['type'], _count: true });
    const priorityDist = await prisma.workItem.groupBy({ by: ['priority'], _count: true });

    const lines: string[] = [];
    lines.push('# AVM 项目中心概览');
    lines.push('');
    lines.push('## 核心指标');
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 项目数 | ${projectCount} |`);
    lines.push(`| 工作项 | ${workItemCount} |`);
    lines.push(`| 团队成员 | ${userCount} |`);
    lines.push(`| 迭代数 | ${iterationCount} |`);
    lines.push('');

    lines.push('## 工作项状态分布');
    for (const s of statusDist) {
      lines.push(`- ${s.status}: ${s._count}`);
    }
    lines.push('');

    lines.push('## 工作项类型分布');
    for (const t of typeDist) {
      lines.push(`- ${t.type}: ${t._count}`);
    }
    lines.push('');

    lines.push('## 优先级分布');
    for (const p of priorityDist) {
      lines.push(`- ${p.priority}: ${p._count}`);
    }

    return {
      ok: true,
      title: '数据概览',
      content: lines.join('\n'),
      data: {
        metrics: { projectCount, workItemCount, userCount, iterationCount },
        statusDist, typeDist, priorityDist,
      },
      actions: [
        { label: '风险扫描', command: 'risk-scan' },
        { label: '项目分析', command: 'analyze-project' },
        { label: '生成周报', command: 'weekly-report' },
      ],
    };
  },
});

// --- 帮助 ---
registerCommand({
  name: 'help',
  alias: ['帮助', '命令列表', '怎么用'],
  description: '查看所有可用的 Agent 命令',
  category: 'admin',
  params: [
    { name: 'category', type: 'select', description: '分类筛选', options: ['work', 'project', 'analysis', 'report', 'admin', 'ai'] },
  ],
  hint: '/help [分类]',
  execute: async (args) => {
    const { category } = args;
    const cmds = listCommands(category);
    const lines: string[] = [];
    lines.push('# Agent 命令列表');
    lines.push('');
    lines.push(`共 **${cmds.length}** 个命令${category ? ` (${category} 分类)` : ''}`);
    lines.push('');

    const byCategory: Record<string, AgentCommand[]> = {};
    for (const cmd of cmds) {
      if (!byCategory[cmd.category]) byCategory[cmd.category] = [];
      byCategory[cmd.category].push(cmd);
    }

    const categoryNames: Record<string, string> = {
      work: '工作项', project: '项目', analysis: '分析', report: '报告', admin: '管理', ai: 'AI',
    };

    for (const [cat, catCmds] of Object.entries(byCategory)) {
      lines.push(`## ${categoryNames[cat] || cat}`);
      for (const cmd of catCmds) {
        lines.push(`- **/${cmd.name}** — ${cmd.description}`);
        if (cmd.hint) lines.push(`  - 用法: \`${cmd.hint}\``);
      }
      lines.push('');
    }

    return {
      ok: true,
      title: `命令列表 (${cmds.length} 个)`,
      content: lines.join('\n'),
      data: { commands: cmds.map(c => ({ name: c.name, description: c.description, category: c.category, hint: c.hint })) },
    };
  },
});

// ============================================================
// 执行入口
// ============================================================

export async function executeAgentCommand(
  commandName: string,
  args: Record<string, any>,
  ctx: CommandContext,
): Promise<CommandResult> {
  const cmd = getCommand(commandName);
  if (!cmd) {
    return {
      ok: false,
      title: '未知命令',
      content: `命令 "${commandName}" 不存在。输入 /help 查看所有可用命令。`,
    };
  }

  try {
    return await cmd.execute(args, ctx);
  } catch (e: any) {
    return {
      ok: false,
      title: `执行失败: ${cmd.name}`,
      content: `错误: ${e.message}`,
    };
  }
}
