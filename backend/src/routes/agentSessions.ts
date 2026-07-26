/**
 * V1.55 AgentSession — 会话 CRUD + Fork
 *
 * 端点：
 *   GET    /api/agents/sessions?agentId=&userId=&limit=   - 列出我的会话
 *   POST   /api/agents/sessions                           - 创建会话
 *   GET    /api/agents/sessions/:id                       - 会话详情
 *   PATCH  /api/agents/sessions/:id                       - 改名 / 更新消息
 *   DELETE /api/agents/sessions/:id                       - 删除（仅 owner）
 *   POST   /api/agents/sessions/:id/fork                  - Fork 会话（Trae Work 风格）
 *   POST   /api/agents/sessions/:id/append                - 追加消息（由 useAgentChat 流式完成后调用）
 */
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { recordAudit, actorFromReq } from '../utils/audit';
import { notifyApiError } from '../utils/apiError';

export const agentSessionsRouter = Router();
agentSessionsRouter.use(requireAuth);

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  time: string;
  attachments?: any[];
  actions?: any[];
}

/** 列出我的会话（按 agentId 过滤可选） */
agentSessionsRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || '';
    const { agentId, limit = '20' } = req.query as Record<string, string>;
    const where: any = { userId };
    if (agentId) where.agentId = agentId;
    const list = await prisma.agentSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Number(limit) || 20, 100),
      include: { agent: { select: { id: true, key: true, name: true, icon: true } } },
    });
    res.json(list);
  } catch (e: any) {
    notifyApiError(res, e, '列出会话失败');
  }
});

/** 创建会话 */
agentSessionsRouter.post('/', async (req: AuthedRequest, res) => {
  try {
    const { agentId, title, messages, metadata } = req.body || {};
    if (!agentId) return res.status(400).json({ error: 'agentId 必填' });
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return res.status(404).json({ error: 'Agent 不存在' });

    const userId = req.user?.id || req.user?.username || 'anonymous';
    const userName = req.user?.displayName || req.user?.username || '匿名';
    const session = await prisma.agentSession.create({
      data: {
        agentId,
        userId,
        userName,
        title: title || '新会话',
        messages: JSON.stringify(messages || []),
        metadata: JSON.stringify(metadata || {}),
      },
    });
    recordAudit('agentSession', session.id, 'create', null, { agentKey: agent.key, title: session.title }, actorFromReq(req));
    res.status(201).json(session);
  } catch (e: any) {
    notifyApiError(res, e, '创建会话失败');
  }
});

/** 详情（仅 owner） */
agentSessionsRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || '';
    const session = await prisma.agentSession.findUnique({
      where: { id: req.params.id },
      include: { agent: { select: { id: true, key: true, name: true, icon: true, systemPrompt: true } } },
    });
    if (!session) return res.status(404).json({ error: '会话不存在' });
    if (session.userId !== userId && req.user?.role !== 'space_admin') {
      return res.status(403).json({ error: '无权访问该会话' });
    }
    res.json({
      ...session,
      messages: parseJsonArray(session.messages),
      metadata: parseJsonObject(session.metadata),
    });
  } catch (e: any) {
    notifyApiError(res, e, '查询会话失败');
  }
});

/** 改名 / 追加消息 */
agentSessionsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || '';
    const session = await prisma.agentSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: '会话不存在' });
    if (session.userId !== userId) return res.status(403).json({ error: '仅 owner 可改' });

    const updates: any = { updatedAt: new Date() };
    if (typeof req.body.title === 'string') updates.title = req.body.title.slice(0, 100);
    if (Array.isArray(req.body.messages)) updates.messages = JSON.stringify(req.body.messages);
    if (req.body.metadata && typeof req.body.metadata === 'object') updates.metadata = JSON.stringify(req.body.metadata);
    const after = await prisma.agentSession.update({ where: { id: req.params.id }, data: updates });
    res.json(after);
  } catch (e: any) {
    notifyApiError(res, e, '更新会话失败');
  }
});

/** 删除（仅 owner） */
agentSessionsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || '';
    const session = await prisma.agentSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: '会话不存在' });
    if (session.userId !== userId && req.user?.role !== 'space_admin') {
      return res.status(403).json({ error: '仅 owner 可删' });
    }
    await prisma.agentSession.delete({ where: { id: req.params.id } });
    recordAudit('agentSession', req.params.id, 'delete', [{ field: 'title', oldValue: session.title, newValue: null }], null, actorFromReq(req));
    res.status(204).end();
  } catch (e: any) {
    notifyApiError(res, e, '删除会话失败');
  }
});

/** Fork 会话（Trae Work 风格：保留消息历史 + 复制标题 + 标记 forkedFrom） */
agentSessionsRouter.post('/:id/fork', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || 'anonymous';
    const userName = req.user?.displayName || req.user?.username || '匿名';
    const original = await prisma.agentSession.findUnique({ where: { id: req.params.id } });
    if (!original) return res.status(404).json({ error: '原会话不存在' });
    if (original.userId !== userId && req.user?.role !== 'space_admin') {
      return res.status(403).json({ error: '无权 Fork 该会话' });
    }

    const metadata = parseJsonObject(original.metadata);
    const forked = await prisma.agentSession.create({
      data: {
        agentId: original.agentId,
        userId,
        userName,
        title: `${original.title} (Fork)`,
        messages: original.messages,  // 复制完整消息历史
        metadata: JSON.stringify({ ...metadata, forkedFrom: original.id, forkedAt: new Date().toISOString() }),
      },
    });
    recordAudit('agentSession', forked.id, 'fork', [{ field: 'forkedFrom', oldValue: original.id, newValue: forked.id }], { summary: `Forked from ${original.id}` }, actorFromReq(req));
    res.status(201).json(forked);
  } catch (e: any) {
    notifyApiError(res, e, 'Fork 会话失败');
  }
});

/** 追加消息（流式输出完成后调用） */
agentSessionsRouter.post('/:id/append', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || '';
    const session = await prisma.agentSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: '会话不存在' });
    if (session.userId !== userId) return res.status(403).json({ error: '仅 owner 可追加' });

    const { message, title } = req.body || {};
    if (!message || !message.role) return res.status(400).json({ error: 'message 必填' });

    const msgs: Message[] = parseJsonArray(session.messages);
    msgs.push(message);

    const updates: any = { messages: JSON.stringify(msgs), updatedAt: new Date() };
    // 首条用户消息时自动设置标题
    if (!session.title || session.title === '新会话') {
      const firstUser = msgs.find(m => m.role === 'user');
      if (firstUser) updates.title = (firstUser.content || '').slice(0, 30) || '新会话';
    }
    if (title) updates.title = title;

    const after = await prisma.agentSession.update({ where: { id: req.params.id }, data: updates });
    res.json(after);
  } catch (e: any) {
    notifyApiError(res, e, '追加消息失败');
  }
});

/** 工具函数 */
function parseJsonArray(s: string | null | undefined): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseJsonObject(s: string | null | undefined): Record<string, any> {
  if (!s) return {};
  try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
