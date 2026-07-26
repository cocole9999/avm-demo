/**
 * V1.55 Agent 反馈 API
 *
 * 端点：
 *   POST /api/agent-feedback              - 提交/更新反馈（按 sessionId+messageId+userId 幂等）
 *   GET  /api/agent-feedback/by-message/:sessionId/:messageId - 查某条消息的反馈
 *   GET  /api/agent-feedback/stats        - Agent 使用统计（管理员可见）
 *   DELETE /api/agent-feedback/:id        - 取消反馈（仅本人）
 */
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { recordAudit, actorFromReq } from '../utils/audit';
import { notifyApiError } from '../utils/apiError';

export const agentFeedbackRouter = Router();
agentFeedbackRouter.use(requireAuth);

/** 提交反馈（upsert） */
agentFeedbackRouter.post('/', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || 'anonymous';
    const { sessionId, messageId, rating, comment } = req.body || {};
    if (!sessionId || !messageId) return res.status(400).json({ error: 'sessionId + messageId 必填' });
    if (!['up', 'down'].includes(rating)) return res.status(400).json({ error: 'rating 必须为 up 或 down' });

    const before = await prisma.agentMessageFeedback.findUnique({
      where: { sessionId_messageId_userId: { sessionId, messageId, userId } },
    });

    const after = await prisma.agentMessageFeedback.upsert({
      where: { sessionId_messageId_userId: { sessionId, messageId, userId } },
      update: { rating, comment: comment || null },
      create: { sessionId, messageId, userId, rating, comment: comment || null },
    });

    recordAudit('agentFeedback', after.id, before ? 'update' : 'create',
      null, { summary: `${userId} 给消息 ${messageId} 评 ${rating}` }, actorFromReq(req));
    res.json(after);
  } catch (e: any) {
    notifyApiError(res, e, '提交反馈失败');
  }
});

/** 查询某条消息的所有反馈 */
agentFeedbackRouter.get('/by-message/:sessionId/:messageId', async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const feedbacks = await prisma.agentMessageFeedback.findMany({
      where: { sessionId, messageId },
    });
    const up = feedbacks.filter(f => f.rating === 'up').length;
    const down = feedbacks.filter(f => f.rating === 'down').length;
    res.json({ up, down, total: feedbacks.length, feedbacks });
  } catch (e: any) {
    notifyApiError(res, e, '查询反馈失败');
  }
});

/** Agent 使用统计（需要 space_admin 角色） */
agentFeedbackRouter.get('/stats', async (req: AuthedRequest, res) => {
  try {
    // 1. 会话总数 + 按 agent 分组
    const sessions = await prisma.agentSession.groupBy({
      by: ['agentId'],
      _count: { _all: true },
    });
    // 2. 消息反馈统计
    const [upCount, downCount, totalCount] = await Promise.all([
      prisma.agentMessageFeedback.count({ where: { rating: 'up' } }),
      prisma.agentMessageFeedback.count({ where: { rating: 'down' } }),
      prisma.agentMessageFeedback.count(),
    ]);
    // 3. Agent 列表
    const agents = await prisma.agent.findMany({
      select: { id: true, key: true, name: true, icon: true, enabled: true, order: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const sessionMap = new Map(sessions.map(s => [s.agentId, s._count._all]));

    res.json({
      feedback: { up: upCount, down: downCount, total: totalCount, rate: totalCount > 0 ? Math.round((upCount / totalCount) * 100) : null },
      sessions: {
        total: sessions.reduce((acc, s) => acc + s._count._all, 0),
        byAgent: agents.map(a => ({
          agentId: a.id,
          key: a.key,
          name: a.name,
          icon: a.icon,
          enabled: a.enabled,
          count: sessionMap.get(a.id) || 0,
        })),
      },
    });
  } catch (e: any) {
    notifyApiError(res, e, '查询 Agent 统计失败');
  }
});

/** 取消反馈（仅本人） */
agentFeedbackRouter.delete('/:id', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username || 'anonymous';
    const fb = await prisma.agentMessageFeedback.findUnique({ where: { id: req.params.id } });
    if (!fb) return res.status(404).json({ error: '反馈不存在' });
    if (fb.userId !== userId && req.user?.role !== 'space_admin') {
      return res.status(403).json({ error: '仅本人可删除' });
    }
    await prisma.agentMessageFeedback.delete({ where: { id: req.params.id } });
    recordAudit('agentFeedback', req.params.id, 'delete',
      [
        { field: 'id', oldValue: fb.id, newValue: null },
        { field: 'sessionId', oldValue: fb.sessionId, newValue: null },
        { field: 'messageId', oldValue: fb.messageId, newValue: null },
        { field: 'rating', oldValue: fb.rating, newValue: null },
      ], { summary: `${userId} 删除反馈 ${req.params.id} (${fb.rating})` }, actorFromReq(req));
    res.status(204).end();
  } catch (e: any) {
    notifyApiError(res, e, '删除反馈失败');
  }
});
