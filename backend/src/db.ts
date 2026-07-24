import { PrismaClient } from '@prisma/client';

const isDev = process.env.NODE_ENV === 'development';

// 性能优化: 连接池配置 + 查询日志
export const prisma = new PrismaClient({
  log: isDev ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// 性能监控: 慢查询检测 (开发环境)
if (isDev) {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const duration = Date.now() - before;
    
    if (duration > 100) {
      console.warn(`[慢查询] ${params.model}.${params.action} 耗时 ${duration}ms`);
    }
    
    return result;
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
