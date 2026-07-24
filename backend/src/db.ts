import { PrismaClient } from '@prisma/client';
import { dbLogger } from './utils/logger';
import { recordSlowQuery, recordDbError } from './utils/metrics';

const isDev = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// 连接池配置：生产环境可通过 PRISMA_CONNECTION_LIMIT 调整（默认 10）
// Prisma 通过 DATABASE_URL 的 ?connection_limit=N 参数控制连接池大小
const CONNECTION_LIMIT = Number(process.env.PRISMA_CONNECTION_LIMIT) || (isProduction ? 10 : 5);
const SLOW_QUERY_THRESHOLD = Number(process.env.SLOW_QUERY_MS) || (isProduction ? 500 : 100);

// 确保 DATABASE_URL 包含 connection_limit 参数
function buildDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || '';
  if (!url) return url;
  // 仅对 PostgreSQL 连接串追加连接池参数（SQLite 忽略）
  if (url.startsWith('postgresql') && !url.includes('connection_limit')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}connection_limit=${CONNECTION_LIMIT}&pool_timeout=10`;
  }
  return url;
}

// 性能优化: 连接池配置 + 查询日志
const prismaClient = new PrismaClient({
  log: isDev ? ['query', 'error', 'warn'] : ['error', 'warn'],
  datasources: {
    db: {
      url: buildDatabaseUrl(),
    },
  },
});

// 性能监控: 慢查询检测（开发+生产均启用，生产只记录 model/action/耗时，不打印 query 明文避免 PII 泄露）
export const prisma = prismaClient.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const before = Date.now();
      try {
        const result = await query(args);
        const duration = Date.now() - before;
        if (duration > SLOW_QUERY_THRESHOLD) {
          recordSlowQuery();
          const meta = { model, operation, duration };
          if (isProduction) {
            dbLogger.warn('慢查询检测', meta);
          } else {
            dbLogger.warn(`[慢查询] ${model}.${operation} 耗时 ${duration}ms`, meta);
          }
        }
        return result;
      } catch (err: any) {
        recordDbError();
        const duration = Date.now() - before;
        dbLogger.error(`数据库操作失败: ${model}.${operation}`, {
          model,
          operation,
          duration,
          error: err?.message,
          code: err?.code,
        });
        throw err;
      }
    },
  },
});

// 启动时输出连接池配置（便于运维确认）
dbLogger.info('Prisma 连接池已配置', {
  connectionLimit: CONNECTION_LIMIT,
  slowQueryThreshold: SLOW_QUERY_THRESHOLD,
  mode: isProduction ? 'production' : 'development',
});

// 优雅关闭
process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
});
