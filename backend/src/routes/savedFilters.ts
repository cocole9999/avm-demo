/**
 * V1.52 团队共享筛选 — SavedFilter CRUD
 *
 * 端点：
 *   GET    /api/saved-filters?resourceKey=xxx    - 列出（个人 + 团队共享合并）
 *   POST   /api/saved-filters                    - 创建
 *   PATCH  /api/saved-filters/:id                - 更新（重命名/改筛选/共享开关）
 *   DELETE /api/saved-filters/:id                - 删除（仅 owner）
 */
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { recordAudit, actorFromReq } from '../utils/audit';

export const savedFilterRouter = Router();
savedFilterRouter.use(requireAuth);

interface FiltersBody {
  resourceKey: string;
  name: string;
  filters: Record<string, any>;
  shared?: boolean;
}

/** 列出某资源下的筛选（个人 + shared=true 的他人共享） */
savedFilterRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const { resourceKey } = req.query as Record<string, string | undefined>;
    if (!resourceKey) return res.status(400).json({ error: 'resourceKey required' });
    const userId = req.user?.id || req.user?.username || '';
    const list = await prisma.savedFilter.findMany({
      where: {
        resourceKey,
        OR: [
          { ownerId: userId },
          { shared: true },
        ],
      },
      orderBy: [{ shared: 'desc' }, { createdAt: 'desc' }],
    });
    // 解析 filters JSON
    const out = list.map(f => ({
      ...f,
      filters: (() => { try { return JSON.parse(f.filters); } catch { return {}; } })(),
    }));
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** 创建筛选 */
savedFilterRouter.post('/', async (req: AuthedRequest, res) => {
  try {
    const { resourceKey, name, filters, shared } = (req.body || {}) as FiltersBody;
    if (!resourceKey?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'resourceKey and name required' });
    }
    const userId = req.user?.id || req.user?.username || 'anonymous';
    const userName = req.user?.displayName || req.user?.username || '匿名';
    const item = await prisma.savedFilter.create({
      data: {
        resourceKey: resourceKey.trim(),
        name: name.trim(),
        filters: JSON.stringify(filters || {}),
        shared: !!shared,
        ownerId: userId,
        ownerName: userName,
      },
    });
    recordAudit('savedFilter', item.id, 'create', null, { resourceKey, name, shared: !!shared }, actorFromReq(req));
    res.status(201).json({
      ...item,
      filters: (() => { try { return JSON.parse(item.filters); } catch { return {}; } })(),
    });
  } catch (e: any) {
    // 同名唯一约束冲突
    if (String(e.message).includes('Unique constraint')) {
      return res.status(409).json({ error: '同名筛选已存在' });
    }
    res.status(400).json({ error: e.message });
  }
});

/** 更新筛选（重命名 / 改筛选条件 / 共享开关） */
savedFilterRouter.patch('/:id', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const before = await prisma.savedFilter.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '筛选不存在' });
    const userId = req.user?.id || req.user?.username || '';
    if (before.ownerId !== userId) return res.status(403).json({ error: '只有创建者可修改' });

    const allowed: any = {};
    const { name, filters, shared } = (req.body || {}) as Partial<FiltersBody>;
    if (name !== undefined) allowed.name = name.trim();
    if (filters !== undefined) allowed.filters = JSON.stringify(filters);
    if (shared !== undefined) allowed.shared = !!shared;

    const updated = await prisma.savedFilter.update({ where: { id }, data: allowed });
    recordAudit('savedFilter', id, 'update', null, { summary: `更新筛选: ${updated.name}` }, actorFromReq(req));
    res.json({
      ...updated,
      filters: (() => { try { return JSON.parse(updated.filters); } catch { return {}; } })(),
    });
  } catch (e: any) {
    if (String(e.message).includes('Unique constraint')) {
      return res.status(409).json({ error: '同名筛选已存在' });
    }
    res.status(400).json({ error: e.message });
  }
});

/** 删除筛选（仅 owner） */
savedFilterRouter.delete('/:id', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const before = await prisma.savedFilter.findUnique({ where: { id } });
    if (!before) return res.status(204).end();
    const userId = req.user?.id || req.user?.username || '';
    if (before.ownerId !== userId) return res.status(403).json({ error: '只有创建者可删除' });
    await prisma.savedFilter.delete({ where: { id } });
    recordAudit('savedFilter', id, 'delete', null, { summary: `删除筛选: ${before.name}` }, actorFromReq(req));
    res.status(204).end();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
