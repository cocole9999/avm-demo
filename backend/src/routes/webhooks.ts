/**
 * WebHook 出站 + 接收
 *
 * P0-3/P0-5 安全修复：
 *   ① /inbox/:token 端点提前到 requireAuth 之前注册，仅靠 URL token 鉴权（外部 webhook 服务无 Bearer token）
 *   ② PATCH /configs/:id 加字段白名单，防止批量赋值攻击（避免改写 secret/spaceId/createdBy）
 */
import { Router } from 'express';
import { prisma } from '../db';
import { triggerWebhooks } from '../services/webhookEngine';
import { requireAuth, autoRole } from '../middleware/auth';

export const webhookRouter = Router();

// ========== P0-5: /inbox/:token 必须在 requireAuth 之前注册 ==========
// 外部 webhook 服务调用此端点，无法携带 Bearer token，仅靠 URL 中的 token 鉴权
webhookRouter.post('/inbox/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 8) {
      return res.status(401).json({ error: 'invalid webhook token' });
    }
    // 优先按 secret 查, 其次按 id (cuid 长度也 >=20)
    const config = await prisma.webhookConfig.findFirst({
      where: { OR: [{ secret: token }, { id: token }], enabled: true },
    });
    if (!config) {
      console.warn('[Webhook Inbox] 未授权 token:', token.slice(0, 8) + '***');
      return res.status(401).json({ error: 'invalid webhook token' });
    }
    // P3 日志泄露修复：只记录 config.id，不记录 name（可能含敏感信息）
    console.log('[Webhook Inbox] matched configId:', config.id);
    res.json({ ok: true, configId: config.id, received: req.body });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// V1.11: 后续路由鉴权 + 写保护
webhookRouter.use(requireAuth);
webhookRouter.use(autoRole());

// 列出 Webhook
webhookRouter.get('/configs', async (req, res) => {
  try {
    const { spaceId } = req.query as any;
    const where: any = {};
    if (spaceId) where.spaceId = spaceId;
    const list = await prisma.webhookConfig.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

webhookRouter.get('/configs/:id', async (req, res) => {
  const c = await prisma.webhookConfig.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

webhookRouter.post('/configs', async (req, res) => {
  try {
    const { spaceId, name, url, events, headers, secret, enabled, retryCount, createdBy } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name, url required' });
    const c = await prisma.webhookConfig.create({
      data: {
        spaceId: spaceId || null, name, url, events: events || '',
        headers: typeof headers === 'string' ? headers : JSON.stringify(headers || {}),
        secret: secret || '',
        enabled: enabled !== false,
        retryCount: retryCount ?? 3,
        createdBy: createdBy || null,
      },
    });
    res.status(201).json(c);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// P0-3: 字段白名单修复批量赋值漏洞
// 旧代码 `data: req.body` 允许攻击者改写 secret/spaceId/createdBy 等敏感字段
webhookRouter.patch('/configs/:id', async (req, res) => {
  try {
    const { name, url, events, headers, secret, enabled, retryCount } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url;
    if (events !== undefined) data.events = events;
    if (headers !== undefined) data.headers = typeof headers === 'string' ? headers : JSON.stringify(headers || {});
    if (secret !== undefined) data.secret = secret;
    if (enabled !== undefined) data.enabled = enabled;
    if (retryCount !== undefined) data.retryCount = retryCount;
    // 注意：spaceId/createdBy 不在白名单内，禁止通过 PATCH 修改
    const c = await prisma.webhookConfig.update({ where: { id: req.params.id }, data });
    res.json(c);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

webhookRouter.delete('/configs/:id', async (req, res) => {
  try {
    await prisma.webhookConfig.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 测试发送
webhookRouter.post('/configs/:id/test', async (req, res) => {
  try {
    const c = await prisma.webhookConfig.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Not found' });
    const payload = req.body.payload || { test: true, message: 'AVM Webhook test' };
    const event = req.body.event || 'webhook.test';
    const result = await triggerWebhooks(event, payload, [c]);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// 调用日志
webhookRouter.get('/logs', async (req, res) => {
  try {
    const { configId, limit } = req.query as any;
    const where: any = {};
    if (configId) where.configId = configId;
    const list = await prisma.webhookLog.findMany({
      where, orderBy: { createdAt: 'desc' }, take: Number(limit) || 50,
    });
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
