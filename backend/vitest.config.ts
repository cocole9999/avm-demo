/**
 * vitest 全局配置 (V1.30.1 P2-3)
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/db.ts',
        'src/seed.ts',
        'src/index.ts',         // 启动入口, 测不测意义不大
        'src/routes/health.ts', // 简单探活
      ],
      thresholds: {
        // 起步阶段: 关键模块 utils/* 100%, 其他随时间提升
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },
  },
});
