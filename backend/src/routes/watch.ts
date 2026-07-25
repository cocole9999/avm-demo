/**
 * V1.50 工作项订阅/关注路由
 *
 * POST   /api/work-items/:id/watch     - 关注（添加 watcher）
 * DELETE /api/work-items/:id/watch     - 取消关注
 * GET    /api/work-items/:id/watchers  - 列出所有关注者
 * GET    /api/work-items/watching/me   - 列出当前用户关注的所有工作项
 */
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { recordAudit, actorFromReq } from '../utils/audit';

export const watchRouter = Router();
watchRouter.use(requireAuth);

// 关注 / 取消关注 — POST 加 / DELETE 减
watchRouter.post('/:id/watch', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.username;
    const userName = req.user?.displayName || req.user?.username;
    if (!userId) return res.status(401).json({ error: '未登录' });
    const wi = await prisma.workItem.findUnique({ where: { id }, select: { id: true, key: true, title: true } });
    if (!wi) return res.status(404).json({ error: '工作项不存在' });
    // upsert 防重复
    await prisma.workItemWatcher.upsert({
      where: { workItemId_userId: { workItemId: id, userId: String(userId) } },
      create: { workItemId: id, userId: String(userId), userName: String(userName) },
      update: {}, // 已存在则忽略
    });
    recordAudit('workItem', id, 'update', null, { method: 'watch', summary: `${userName} 关注了 ${wi.key}` }, actorFromReq(req));
    res.json({ ok: true, watching: true, workItemId: id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

watchRouter.delete('/:id/watch', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.username;
    if (!userId) return res.status(401).json({ error: '未登录' });
    await prisma.workItemWatcher.deleteMany({
      where: { workItemId: id, userId: String(userId) },
    });
    recordAudit('workItem', id, 'update', null, { method: 'unwatch', summary: `取消关注 ${id}` }, actorFromReq(req));
    res.json({ ok: true, watching: false, workItemId: id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 列出工作项的所有关注者
watchRouter.get('/:id/watchers', async (req, res) => {
  try {
    const { id } = req.params;
    const list = await prisma.workItemWatcher.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(list);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 列出当前用户关注的所有工作项
watchRouter.get('/watching/me', async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.id || req.user?.username;
    if (!userId) return res.status(401).json({ error: '未登录' });
    const list = await prisma.workItemWatcher.findMany({
      where: { userId: String(userId) },
      orderBy: { createdAt: 'desc' },
      include: {
        workItem: {
          select: {
            id: true, key: true, title: true, type: true, status: true, priority: true, updatedAt: true,
          },
        },
      },
    });
    res.json(list);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
