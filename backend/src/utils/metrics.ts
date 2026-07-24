/**
 * 轻量 Prometheus 指标采集 (V1.46)
 *
 * 不引入 prom-client 依赖，自实现 Prometheus exposition format 输出。
 * 采集：HTTP 请求计数/耗时、Node.js 进程内存/CPU、Prisma 连接池慢查询计数。
 * 端点：GET /metrics（建议在负载均衡器层限制内网访问）
 */
import { Request, Response, NextFunction } from 'express';

// ===== 指标存储 =====

interface HistogramBucket {
  le: number;  // 上界（秒）
  count: number;
}

const httpRequestsTotal = new Map<string, number>();            // key: method|route|status
const httpRequestDuration = new Map<string, HistogramBucket[]>(); // key: method|route
let slowQueryCount = 0;
let dbErrorCount = 0;

// 默认耗时分桶（秒），对齐 prom-client 默认 buckets
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
function emptyBuckets(): HistogramBucket[] {
  return DEFAULT_BUCKETS.map(le => ({ le, count: 0 }));
}

const processStart = process.hrtime();
const startTime = Date.now();

// ===== 中间件：采集 HTTP 指标 =====

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startNs);
    const durationSec = diff[0] + diff[1] / 1e9;
    const route = normalizeRoute(req.route?.path || req.path);
    const method = req.method;
    const status = String(res.statusCode);

    // 计数器
    const counterKey = `${method}|${route}|${status}`;
    httpRequestsTotal.set(counterKey, (httpRequestsTotal.get(counterKey) || 0) + 1);

    // 直方图
    const histKey = `${method}|${route}`;
    let buckets = httpRequestDuration.get(histKey);
    if (!buckets) {
      buckets = emptyBuckets();
      httpRequestDuration.set(histKey, buckets);
    }
    for (const b of buckets) {
      if (durationSec <= b.le) b.count++;
    }
  });

  next();
}

/** 规范化路由路径，避免高基数（/api/work-items/123 → /api/work-items/:id） */
function normalizeRoute(p: string): string {
  if (!p) return 'unknown';
  return p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:id');
}

// ===== 外部钩子：db.ts 慢查询/错误计数 =====

export function recordSlowQuery(): void { slowQueryCount++; }
export function recordDbError(): void { dbErrorCount++; }

// ===== /metrics 端点处理器 =====

export function metricsHandler(_req: Request, res: Response): void {
  res.type('text/plain; version=0.0.4; charset=utf-8');
  res.send(renderMetrics());
}

function renderMetrics(): string {
  const lines: string[] = [];
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptimeSec = process.uptime();
  const elapsed = process.hrtime(processStart);
  const elapsedSec = elapsed[0] + elapsed[1] / 1e9;

  // ===== HTTP 请求计数 =====
  lines.push('# HELP http_requests_total HTTP 请求总数（按 method/route/status）');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of httpRequestsTotal) {
    const [method, route, status] = key.split('|');
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // ===== HTTP 请求耗时直方图 =====
  lines.push('# HELP http_request_duration_seconds HTTP 请求耗时分布');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, buckets] of httpRequestDuration) {
    const [method, route] = key.split('|');
    const labels = `method="${method}",route="${route}"`;
    for (const b of buckets) {
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${b.le}"} ${b.count}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${buckets[buckets.length - 1].count}`);
    const total = buckets[buckets.length - 1].count;
    let sum = 0; // 精确 sum 需要累加，这里用 bucket 中点估算（轻量方案）
    for (const b of buckets) sum += b.count * (b.le / 2);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${sum.toFixed(4)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${total}`);
  }

  // ===== Node.js 进程指标 =====
  lines.push('# HELP nodejs_memory_heap_used_bytes Node.js 堆内存已用（字节）');
  lines.push('# TYPE nodejs_memory_heap_used_bytes gauge');
  lines.push(`nodejs_memory_heap_used_bytes ${mem.heapUsed}`);

  lines.push('# HELP nodejs_memory_heap_total_bytes Node.js 堆内存总量（字节）');
  lines.push('# TYPE nodejs_memory_heap_total_bytes gauge');
  lines.push(`nodejs_memory_heap_total_bytes ${mem.heapTotal}`);

  lines.push('# HELP nodejs_memory_rss_bytes Node.js 进程常驻内存（字节）');
  lines.push('# TYPE nodejs_memory_rss_bytes gauge');
  lines.push(`nodejs_memory_rss_bytes ${mem.rss}`);

  lines.push('# HELP nodejs_process_cpu_user_microseconds Node.js 用户态 CPU（微秒）');
  lines.push('# TYPE nodejs_process_cpu_user_microseconds counter');
  lines.push(`nodejs_process_cpu_user_microseconds ${cpu.user}`);

  lines.push('# HELP nodejs_process_cpu_system_microseconds Node.js 内核态 CPU（微秒）');
  lines.push('# TYPE nodejs_process_cpu_system_microseconds counter');
  lines.push(`nodejs_process_cpu_system_microseconds ${cpu.system}`);

  lines.push('# HELP nodejs_process_uptime_seconds Node.js 进程运行时长（秒）');
  lines.push('# TYPE nodejs_process_uptime_seconds gauge');
  lines.push(`nodejs_process_uptime_seconds ${uptimeSec.toFixed(2)}`);

  // ===== 应用业务指标 =====
  lines.push('# HELP avm_slow_queries_total 慢查询总数');
  lines.push('# TYPE avm_slow_queries_total counter');
  lines.push(`avm_slow_queries_total ${slowQueryCount}`);

  lines.push('# HELP avm_db_errors_total 数据库操作错误总数');
  lines.push('# TYPE avm_db_errors_total counter');
  lines.push(`avm_db_errors_total ${dbErrorCount}`);

  lines.push('# HELP avm_process_start_time_seconds 进程启动时间戳（秒）');
  lines.push('# TYPE avm_process_start_time_seconds gauge');
  lines.push(`avm_process_start_time_seconds ${(startTime / 1000).toFixed(0)}`);

  lines.push('# HELP avm_metrics_scrape_duration_seconds 指标采集耗时（秒，用于监控采集健康）');
  lines.push('# TYPE avm_metrics_scrape_duration_seconds gauge');
  lines.push(`avm_metrics_scrape_duration_seconds ${elapsedSec.toFixed(4)}`);

  return lines.join('\n') + '\n';
}
