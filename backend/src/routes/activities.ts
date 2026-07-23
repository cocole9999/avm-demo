import { Router } from 'express';
import { prisma } from '../db';

export const activityRouter = Router();

activityRouter.get('/', async (req, res) => {
  const { workItemId, limit } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (workItemId) where.workItemId = workItemId;
  const items = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit ? Number(limit) : 50,
  });
  res.json(items);
});