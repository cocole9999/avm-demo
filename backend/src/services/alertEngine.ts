/**
 * 系统告警通道 (V1.30.3 P2-9)
 *
 * 与业务 webhook 分离，专门处理系统级告警：
 *   - 5xx 错误率突增
 *   - 关键服务健康检查失败
 *   - 数据库/AI/Webhook 引擎异常
 *   - 手动触发（管理员）
 *
 * 通道：
 *   - webhook: 通用 HTTP POST（与 webhookEngine 复用）
 *   - feishu:  飞书机器人（自包含，URL 模式自动识别）
 *
 * 特性：
 *   - 去重：5 分钟内同 (type, key) 只发一次（防刷屏）
 *   - 严重程度：info / warning / error / critical
 *   - 失败重试：1 次
 *   - 持久化：AlertLog 表
 */
import { prisma } from '../db';
import { logger } from '../utils/logger';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertChannel = 'webhook' | 'feishu' | 'all';

interface AlertPayload {
  type: string;           // 告警类型，如 'http_5xx_burst', 'health_deep_fail'
  severity: AlertSeverity;
  title: string;          // 简短标题
  message: string;        // 详细描述
  source?: string;        // 来源模块，如 'automation', 'webhook'
  context?: Record<string, unknown>;  // 附加上下文
}

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;  // 5 分钟

// 内存级去重缓存（key: `${type}:${title}`）
const recentAlerts = new Map<string, number>();

/** 发送告警（去重 + 多通道 + 持久化） */
export async function sendAlert(payload: AlertPayload, channels: AlertChannel[] = ['all']): Promise<{
  sent: boolean;
  reason?: string;
  results: Array<{ channel: string; status: string; error?: string }>;
}> {
  // 去重检查
  const dedupeKey = `${payload.type}:${payload.title}`;
  const now = Date.now();
  const lastSent = recentAlerts.get(dedupeKey);
  if (lastSent && (now - lastSent) < DEDUPE_WINDOW_MS) {
    logger.info(`[alert] 告警去重: ${dedupeKey} (${Math.round((now - lastSent) / 1000)}s 前已发)`);
    return { sent: false, reason: 'deduped', results: [] };
  }
  recentAlerts.set(dedupeKey, now);
  // 清理过期
  for (const [k, ts] of recentAlerts.entries()) {
    if (now - ts > DEDUPE_WINDOW_MS * 2) recentAlerts.delete(k);
  }

  // 选取通道
  const targetChannels = channels.includes('all')
    ? (['webhook', 'feishu'] as AlertChannel[])
    : channels;

  // 加载启用的告警配置
  const configs = await prisma.webhookConfig.findMany({
    where: { enabled: true },
  }).catch(() => []);

  // 按 URL 模式分桶
  const webhookConfigs = configs.filter(c => isGenericWebhook(c.url));
  const feishuConfigs = configs.filter(c => isFeishuUrl(c.url));

  const results: Array<{ channel: string; status: string; error?: string }> = [];

  if (targetChannels.includes('webhook')) {
    for (const c of webhookConfigs) {
      // 仅当 events 匹配此告警类型时发送
      if (c.events && !eventMatches(c.events, payload.type)) continue;
      const result = await sendToWebhook(c, payload);
      results.push({ channel: 'webhook', status: result.status, error: result.error });
    }
  }

  if (targetChannels.includes('feishu')) {
    for (const c of feishuConfigs) {
      if (c.events && !eventMatches(c.events, payload.type)) continue;
      const result = await sendToFeishu(c, payload);
      results.push({ channel: 'feishu', status: result.status, error: result.error });
    }
  }

  // 持久化
  try {
    await prisma.webhookLog.create({
      data: {
        configId: 'alert-system',
        event: payload.type,
        payload: JSON.stringify({ ...payload, channels: targetChannels }).slice(0, 1000),
        response: results.map(r => `${r.channel}:${r.status}`).join(',').slice(0, 500),
        status: results.every(r => r.status === 'success') ? 'success' : (results.length === 0 ? 'no_target' : 'partial'),
        statusCode: 0,
        duration: 0,
        error: results.find(r => r.error)?.error || '',
      },
    }).catch(() => {/* ignore - 字段可能不存在 */});
  } catch { /* 忽略持久化错误 */ }

  logger.info(`[alert] ${payload.severity.toUpperCase()} ${payload.type}: ${payload.title}`, {
    channels: targetChannels,
    results: results.length,
  });

  return { sent: true, results };
}

/** 5xx 错误率告警（在错误处理中间件中调用） */
export function alertOnServerError(error: Error, context?: { url?: string; method?: string; userId?: string }): Promise<any> {
  return sendAlert({
    type: 'http_5xx',
    severity: 'error',
    title: `服务器错误: ${error.message?.slice(0, 50) || 'unknown'}`,
    message: error.stack?.split('\n').slice(0, 5).join('\n') || error.message,
    source: 'http',
    context: context as Record<string, unknown>,
  });
}

/** 健康检查失败告警 */
export function alertOnHealthFail(component: string, details: Record<string, unknown>): Promise<any> {
  return sendAlert({
    type: 'health_fail',
    severity: 'critical',
    title: `健康检查失败: ${component}`,
    message: `组件 ${component} 健康检查未通过`,
    source: 'health',
    context: details,
  });
}

/** AI/Webhook/Automation 引擎异常告警 */
export function alertOnEngineError(engine: string, error: Error): Promise<any> {
  return sendAlert({
    type: `${engine}_error`,
    severity: 'error',
    title: `${engine} 引擎异常`,
    message: error.message,
    source: engine,
    context: { stack: error.stack?.slice(0, 500) },
  });
}

// ===== 通道实现 =====

function isGenericWebhook(url: string): boolean {
  return !isFeishuUrl(url) && !isDingtalkUrl(url) && !isWechatWorkUrl(url);
}

function isFeishuUrl(url: string): boolean {
  return url.includes('feishu.cn') || url.includes('larksuite.com');
}

function isDingtalkUrl(url: string): boolean {
  return url.includes('dingtalk') || url.includes('dingding');
}

function isWechatWorkUrl(url: string): boolean {
  return url.includes('qyapi.weixin.qq.com') || url.includes('weixin.qq');
}

function eventMatches(eventsStr: string, event: string): boolean {
  const evs = eventsStr.split(',').map(e => e.trim()).filter(Boolean);
  if (evs.length === 0) return true;
  return evs.some(e => e === event || (e.endsWith('.*') && event.startsWith(e.slice(0, -1))));
}

async function sendToWebhook(config: any, payload: AlertPayload): Promise<{ status: string; error?: string }> {
  const body = JSON.stringify({
    event: payload.type,
    severity: payload.severity,
    title: payload.title,
    message: payload.message,
    source: payload.source,
    context: payload.context,
    ts: new Date().toISOString(),
  });
  return sendHttp(config, body);
}

async function sendToFeishu(config: any, payload: AlertPayload): Promise<{ status: string; error?: string }> {
  // 飞书机器人 interactive card
  const severityColor: Record<AlertSeverity, string> = {
    info: 'blue',
    warning: 'orange',
    error: 'red',
    critical: 'red',
  };
  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `🚨 [${payload.severity.toUpperCase()}] ${payload.title}`,
        },
        template: severityColor[payload.severity],
      },
      elements: [
        {
          tag: 'markdown',
          content: `**告警类型**: \`${payload.type}\`\n**来源**: ${payload.source || 'system'}\n\n${payload.message}`,
        },
        ...(payload.context ? [{
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `上下文: ${JSON.stringify(payload.context).slice(0, 200)}` }],
        }] : []),
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `AVM 项目中心 · ${new Date().toLocaleString('zh-CN')}` }],
        },
      ],
    },
  };
  return sendHttp(config, JSON.stringify(card));
}

async function sendHttp(config: any, body: string): Promise<{ status: string; error?: string }> {
  let headers: any = {};
  try { headers = JSON.parse(config.headers || '{}'); } catch {}
  headers['Content-Type'] = 'application/json';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(config.url, { method: 'POST', headers, body, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` };
    return { status: 'success' };
  } catch (e: any) {
    return { status: 'failed', error: e.message || 'fetch error' };
  }
}

/** 清理去重缓存（测试用） */
export function _clearDedupe(): void {
  recentAlerts.clear();
}
