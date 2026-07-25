/**
 * vitest 全局配置 (V1.30.1 P2-3, V1.54 调整)
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
      reportOnFailure: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/db.ts',
        'src/seed.ts',
        'src/index.ts',         // 启动入口, 测不测意义不大
        'src/routes/health.ts', // 简单探活
      ],
      thresholds: {
        // 防倒退基线（V1.54 实测值 -1% 缓冲）
        // 实测: lines 9.68% / fn 13.58% / branches 9.06% / stmts 9.58%
        lines: 9,
        functions: 13,
        branches: 8,
        statements: 9,
      },
    },
  },
});
