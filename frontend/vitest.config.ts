/**
 * 前端 vitest 配置 (V1.30.2 P3-1b, V1.54 调整)
 *
 * 覆盖策略:
 * - 全局门槛设为当前基线 -1% 防倒退（V1.54 实测 lines 3.87% / fn 2% / branches 3.04% / stmt 3.63%）
 * - utils/* 纯函数模块需高覆盖（download.ts 93% / workItemLinker.ts 100%）
 * - 其他模块随测试补充逐步提升
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',         // 入口
        'src/**/*.test.{ts,tsx}',
      ],
      thresholds: {
        // 防倒退基线（V1.54 实测值 -1% 缓冲）
        lines: 3,
        functions: 1,
        branches: 2,
        statements: 3,
      },
    },
  },
});
