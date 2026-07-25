/**
 * AI 查询类工具集 (V1.46.2 重构)
 *
 * 本文件已拆分到 ./aiTools/ 目录下的多个业务域文件:
 *   - types.ts          类型定义
 *   - workItems.ts      工作项核心
 *   - projects.ts       项目实体
 *   - flowReview.ts     流程与评审
 *   - activityTest.ts   活动与测试
 *   - dashboard.ts      仪表盘与图表
 *   - system.ts         系统管理
 *   - config.ts         配置类
 *   - resources.ts      资源与基线
 *   - aiSettings.ts     AI 设置与报告
 *   - index.ts          汇总导出
 *
 * 本文件保留为向后兼容入口, re-export 所有内容
 */
export * from './aiTools/index';
export type { ToolDefinition } from './aiTools/types';
export { QUERY_TOOLS } from './aiTools/index';
