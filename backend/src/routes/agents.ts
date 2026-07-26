/**
 * V1.55 AI 专用 Agent — Agent 配置 CRUD
 *
 * 端点：
 *   GET    /api/agents              - 列出可见 Agent（管理员可看所有）
 *   GET    /api/agents/:idOrKey     - 详情
 *   PATCH  /api/agents/:id         - 更新（启用/禁用/改默认模型/改限定页/改工具集）— 需 space_admin
 *   POST   /api/agents/seed        - 重置 6 个内置 Agent（幂等 upsert）— 需 space_admin
 *
 * 普通用户只能 GET；管理操作需要 space_admin。
 */
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { recordAudit, actorFromReq, diffFields } from '../utils/audit';
import { AGENT_PROMPTS, findAgentPrompt } from '../services/agentPrompts';
import { notifyApiError, extractApiError } from '../utils/apiError';

export const agentsRouter = Router();
agentsRouter.use(requireAuth);

/** 列出可见 Agent（按 order 升序，禁用排最后） */
agentsRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'space_admin' || req.user?.role === 'tenant_admin';
    const agents = await prisma.agent.findMany({
      where: isAdmin ? {} : { enabled: true },
      orderBy: [{ enabled: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
    });
    const out = agents.map(a => ({
      ...a,
      allowedPages: parseJsonArray(a.allowedPages),
      allowedTools: parseJsonArray(a.allowedTools),
    }));
    res.json(out);
  } catch (e: any) {
    notifyApiError(res, e, '列出 Agent 失败');
  }
});

/** 详情（支持 id 或 key） */
agentsRouter.get('/:idOrKey', async (req: AuthedRequest, res) => {
  try {
    const { idOrKey } = req.params;
    const agent = await prisma.agent.findFirst({
      where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
    });
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });
    res.json({
      ...agent,
      allowedPages: parseJsonArray(agent.allowedPages),
      allowedTools: parseJsonArray(agent.allowedTools),
    });
  } catch (e: any) {
    notifyApiError(res, e, '查询 Agent 失败');
  }
});

/** 更新（需 space_admin） */
agentsRouter.patch('/:id', requireRole('space_admin'), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const updates: any = {};
    const allowed = ['name', 'description', 'icon', 'enabled', 'order', 'llmConfigId', 'scope', 'systemPrompt'];
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if ('allowedPages' in req.body) updates.allowedPages = JSON.stringify(req.body.allowedPages || []);
    if ('allowedTools' in req.body) updates.allowedTools = JSON.stringify(req.body.allowedTools || []);

    const before = await prisma.agent.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'Agent 不存在' });

    const after = await prisma.agent.update({ where: { id }, data: updates });
    const fields = Object.keys(updates);
    recordAudit('agent', id, 'update', diffFields(before as any, after as any, fields), null, actorFromReq(req));
    res.json({
      ...after,
      allowedPages: parseJsonArray(after.allowedPages),
      allowedTools: parseJsonArray(after.allowedTools),
    });
  } catch (e: any) {
    notifyApiError(res, e, '更新 Agent 失败');
  }
});

/** 重置 6 个内置 Agent（幂等 upsert）— 需 space_admin */
agentsRouter.post('/seed/builtin', requireRole('space_admin'), async (req: AuthedRequest, res) => {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const created: any[] = [];
    for (const tpl of AGENT_PROMPTS) {
      const data = {
        key: tpl.key,
        name: tpl.name,
        description: tpl.description,
        icon: tpl.icon,
        systemPrompt: tpl.buildSystemPrompt({
          user: '{{user}}',
          page: '{{page}}',
          pageName: '{{pageName}}',
          context: '{{context}}',
          date,
        }),
        scope: tpl.scope,
        allowedPages: JSON.stringify(tpl.allowedPages),
        allowedTools: JSON.stringify(tpl.allowedTools),
        order: tpl.defaultOrder,
        enabled: true,
      };
      const agent = await prisma.agent.upsert({
        where: { spaceId_key: { spaceId: null as any, key: tpl.key } },
        update: { ...data, updatedAt: new Date() },
        create: { spaceId: null, ...data },
      });
      created.push(agent);
    }
    recordAudit('agent', null, 'seed', null, { summary: `Seed ${created.length} agents` }, actorFromReq(req));
    res.json({ ok: true, count: created.length, agents: created.map(a => ({ id: a.id, key: a.key, name: a.name })) });
  } catch (e: any) {
    notifyApiError(res, e, 'Seed Agent 失败');
  }
});

/** 工具函数：解析 JSON 数组 */
function parseJsonArray(s: string | null | undefined): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
