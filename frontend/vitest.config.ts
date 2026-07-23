/**
 * 前端 vitest 配置 (V1.30.2 P3-1b)
 *
 * 覆盖目标:
 * - utils/*: 100% (纯函数)
 * - 其他: 随时间提升
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
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
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
      },
    },
  },
});
