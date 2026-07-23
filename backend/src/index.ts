import express from 'express';
import cors from 'cors';
import {
  initSentry, sentryErrorHandler, setupSentryExpressHandlers,
  captureException, setUser,
} from './utils/sentry';
import { alertOnServerError } from './services/alertEngine';
import { workItemRouter } from './routes/workItems';
import { iterationRouter } from './routes/iterations';
import { commentRouter } from './routes/comments';
import { activityRouter } from './routes/activities';
import { metaRouter } from './routes/meta';
import { flowRouter } from './routes/flows';
import { reviewRouter } from './routes/reviews';
import { chartRouter } from './routes/charts';
import { dashboardRouter } from './routes/dashboards';
import { aiRouter } from './routes/ai';
import { userRouter } from './routes/users';
import { spaceRouter } from './routes/spaces';
import { notificationRouter } from './routes/notifications';
import { favoriteRouter } from './routes/favorites';
import { resourceRouter } from './routes/resources';
import { searchRouter } from './routes/search';
import { workbenchRouter } from './routes/workbench';
import { fieldRouter } from './routes/fields';
import { templateRouter } from './routes/templates';
import { automationRouter } from './routes/automation';
import { webhookRouter } from './routes/webhooks';
import { importRouter } from './routes/imports';
import { handoverRouter } from './routes/handover';
import { treeRouter } from './routes/tree';
import { resourceAnalysisRouter, baselineRouter } from './routes/analysis';
import { mcpRouter } from './routes/mcp';
import { testRouter } from './routes/tests';
import { ssoRouter } from './routes/sso';
import { llmSettingsRouter } from './routes/llmSettings';
import { customerRouter } from './routes/customers';
import { carModelRouter } from './routes/carModels';
import { contactRouter } from './routes/contacts';
import { projectRouter } from './routes/projects';
import { aiCommandRouter } from './routes/aiCommand';
import { exportRouter } from './routes/export';
import { dependencyRouter } from './routes/dependencies';
import { startRiskScanner } from './services/riskScanner';
import { requireAuth } from './middleware/auth';
import { auditLogRouter } from './routes/auditLogs';
import { mentionRouter } from './routes/mentions';
import { uploadRouter } from './routes/uploads';
import { healthRouter } from './routes/health';
import { helmetMiddleware, globalLimiter } from './middleware/security';
import { logger } from './utils/logger';
import morgan from 'morgan';
import { attachWsServer, getStats, pushToUser, broadcastAll, pushToRole } from './services/wsServer';
import http from 'http';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// V1.30.3 P2-8: Sentry 错误追踪（必须最早初始化）
initSentry();
// Sentry v10: requestData / tracing 由默认集成自动处理，无需独立 handler
setupSentryExpressHandlers(app);

// V1.30 安全: 安全头 + 限流 (必须在 cors/parser 之前)
app.use(helmetMiddleware);
app.use(globalLimiter);

// V1.30.3 P0-2: CORS 收紧 (生产环境限制 origin)
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin
  ? { origin: corsOrigin.split(',').map(s => s.trim()), credentials: true }
  : undefined  // 开发模式不限制
));
app.use(express.json({ limit: '10mb' }));

// V1.30 结构化访问日志
app.use(morgan(IS_PRODUCTION
  ? ':remote-addr :method :url :status :res[content-length] - :response-time ms'
  : 'dev',
  { stream: { write: (msg) => logger.info(msg.trim()) } },
));

// V1.23 静态文件服务 - 评论图片
import * as path from 'path';
import * as fs from 'fs';
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// 健康检查（不走 requireAuth）
app.use('/api', healthRouter);

// V1.11: 全局鉴权（在所有 /api/* router 之前）
//   - 白名单内的路径（sso/users.login/health/llm-settings.health）直接放行
//   - dev 模式无 token 视为 dev-user tenant_admin
//   - 生产模式无 token 401
app.use('/api', requireAuth);

app.use('/api/work-items', workItemRouter);
app.use('/api/iterations', iterationRouter);
app.use('/api/comments', commentRouter);
app.use('/api/activities', activityRouter);
app.use('/api/meta', metaRouter);
app.use('/api/flows', flowRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/charts', chartRouter);
app.use('/api/dashboards', dashboardRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-command', aiCommandRouter);
app.use('/api/export', exportRouter);
app.use('/api/dependencies', dependencyRouter);
app.use('/api/users', userRouter);
app.use('/api/spaces', spaceRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/favorites', favoriteRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/search', searchRouter);
app.use('/api/workbench', workbenchRouter);
app.use('/api/fields', fieldRouter);
app.use('/api/templates', templateRouter);
app.use('/api/automation', automationRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/imports', importRouter);
app.use('/api/handover', handoverRouter);
app.use('/api/tree', treeRouter);
app.use('/api/analysis', resourceAnalysisRouter);
app.use('/api/baselines', baselineRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/tests', testRouter);
app.use('/api/sso', ssoRouter);
app.use('/api/llm-settings', llmSettingsRouter);
app.use('/api/customers', customerRouter);
app.use('/api/car-models', carModelRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/projects', projectRouter);
app.use('/api/audit-logs', auditLogRouter);
app.use('/api/mentions', mentionRouter);
app.use('/api/uploads', uploadRouter);

// V1.30.3 P2-8: Sentry error handler（在自定义错误处理之前）
app.use(sentryErrorHandler());

// V1.30.3 P1: 全局错误处理 — 生产环境不泄露内部信息
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  // 5xx 上报 Sentry
  const status = err.status || 500;
  if (status >= 500) {
    captureException(err, { url: _req?.originalUrl, method: _req?.method });
    // V1.30.3 P2-9: 系统告警通道（5xx 自动触发）
    alertOnServerError(err, { url: _req?.originalUrl, method: _req?.method, userId: _req?.user?.id });
  }
  const isProd = process.env.NODE_ENV === 'production';
  if (err.status === 400 || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体格式错误' });
  }
  res.status(status).json({
    error: isProd
      ? '服务器内部错误, 请联系管理员'
      : (err.message || 'Internal Server Error'),
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 AVM Backend listening at http://localhost:${PORT}`);
  logger.info(`   Health:  http://localhost:${PORT}/api/health`);
  logger.info(`   Deep:    http://localhost:${PORT}/api/health/deep`);
  logger.info(`   WS:      ws://localhost:${PORT + 1}/api/ws?token=xxx`);
  logger.info(`   Mode:    ${IS_PRODUCTION ? 'production' : 'development'}`);

  // 启动 AI 风险扫描定时任务（启动 60s 后跑首次，然后每 1 小时）
  startRiskScanner();
});

// V1.15: WebSocket 实时通知
const httpServer = http.createServer(app);
httpServer.listen(PORT + 1, () => {
  console.log(`🔌 AVM WebSocket listening at ws://localhost:${PORT + 1}/api/ws`);
});
attachWsServer(httpServer, '/api/ws');

// 暴露给 routes 用的 push helper (用 module-level singleton)
export const wsPush = {
  toUser: (userId: string, payload: any) => pushToUser(userId, payload),
  toAll: (payload: any) => broadcastAll(payload),
  toRole: async (role: string, payload: any) => pushToRole(role, payload),
  stats: () => getStats(),
};

// 暴露 stats 端点 (admin only)
app.get('/api/ws/stats', requireAuth, (req: any, res) => {
  if (req.user?.role !== 'tenant_admin') return res.status(403).json({ error: 'admin only' });
  res.json(getStats());
});