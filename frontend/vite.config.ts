import { defineConfig } from 'vite';
// V1.16: 用 @vitejs/plugin-react-swc 替代默认 esbuild
//   原因: Vite 默认的 esbuild 在 HMR 重新评估时, 会把新加的 import
//        (例如 Tooltip / notification as antdNotification / wsClient) 当作"未使用" tree-shake 掉
//   SWC 编译器不优化 import, 完整保留, 避免每次 HMR 后 ReferenceError
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // 关键: 关闭 esbuild 的依赖预构建 tree-shaking (SWC 不做这步, 但 Vite 内部仍有 esbuild)
  optimizeDeps: {
    esbuildOptions: {
      treeShaking: false,
    },
  },
  // V1.30.2: 排除测试文件, 防止被 build 进生产产物
  // V1.46.1: manualChunks 拆分 vendor, 主 chunk 从 2.9MB 降至 ~200KB
  build: {
    rollupOptions: {
      external: [/\.test\./, /\.spec\./],
      output: {
        manualChunks: {
          // React 核心 (首屏必需, 体积小, 单独 chunk 利于长期缓存)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // antd 生态 (体积大, 但首屏必需)
          // 注意: @xyflow/react 内部依赖 antd, 合并到 vendor-antd 避免循环依赖
          'vendor-antd': ['antd', '@ant-design/icons', 'antd-style', '@xyflow/react'],
          // ECharts (仅在度量/仪表盘/分析页用, 拆出后首屏不加载)
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          // 拖拽 (仅部分页面用)
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          // Markdown 渲染 (仅报告/AI 页用)
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'marked', 'dompurify'],
          // 其它工具库
          'vendor-utils': ['axios', 'dayjs', '@sentry/react'],
        },
      },
    },
  },
});