/**
 * 健康检查 (V1.30)
 *
 * - 基础: 返回 ok + 服务启动时间
 * - 深度 (/api/health/deep): 探测 DB 连通性, 反馈各项依赖状态
 *   用于负载均衡器 / K8s liveness & readiness probe
 */
import { Router } from 'express';
import { prisma } from '../db';
import { logger } from '../utils/logger';

export const healthRouter = Router();

const START_TIME = Date.now();

/** 基础健康检查 */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    version: process.env.npm_package_version || '1.30',
  });
});

/** 深度健康检查 - 探测依赖 */
healthRouter.get('/health/deep', async (_req, res) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // 1. DB 连通性
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (e: any) {
    checks.database = { ok: false, error: e.message };
  }

  // 2. Node 内存
  const mem = process.memoryUsage();
  const memOk = mem.heapUsed < 500 * 1024 * 1024;  // < 500MB
  checks.memory = { ok: memOk, latencyMs: 0 };
  if (!memOk) checks.memory.error = `heap ${Math.round(mem.heapUsed / 1024 / 1024)}MB > 500MB`;

  // 整体状态
  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  if (!allOk) {
    logger.warn('Health check failed', { checks });
  }

  res.status(status).json({
    status: allOk ? 'ok' : 'degraded',
    ts: new Date().toISOString(),
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    checks,
  });
});
