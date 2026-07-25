/**
 * AI 工具汇总入口
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 *
 * 本文件做两件事:
 *   1. re-export 各业务域文件的全部工具 (供外部 import)
 *   2. 汇总 QUERY_TOOLS 数组 (供 aiTools.ts 注册到 LLM)
 */
export * from './workItems';
export * from './projects';
export * from './flowReview';
export * from './activityTest';
export * from './dashboard';
export * from './system';
export * from './config';
export * from './resources';
export * from './aiSettings';
export * from './types';

// 汇总导出：所有工具（查询 + 写入）
import type { ToolDefinition } from './types';
import { getWorkItem, addWorkItemRelation, removeWorkItemRelation } from './workItems';
import {
  getCustomer, listCarModels, getCarModel, deleteCustomer, deleteCarModel, deleteContact,
  getExternalDependency, createExternalDependency, updateExternalDependency, deleteExternalDependency,
} from './projects';
import {
  listIterations, listFlows, getFlow, deleteIteration, deleteFlow,
  listReviews, getReview, createReview, finalizeReview, deleteComment,
} from './flowReview';
import {
  listActivities, listTestCases, listTestPlans, listTestRuns, getTestRun,
  createTestCase, updateTestCase, createTestPlan, createTestRun,
} from './activityTest';
import {
  listDashboards, listCharts, getDashboard,
  createDashboard, updateDashboard, deleteDashboard,
  createChart, updateChart, deleteChart,
} from './dashboard';
import {
  listUsers, listSpaces, listSpaceMembers, getTenant, listAuditLogs,
  listSSOSettings, listSSOLogs,
  createSpace, updateSpace, addSpaceMember, removeSpaceMember,
  createUser, updateUser, resetUserPassword,
  createNotification, listFavorites, addFavorite, removeFavorite,
  listWorkHandovers, createWorkHandover, completeWorkHandover,
} from './system';
import {
  listAutomationRules, listAutomationLogs,
  createAutomationRule, updateAutomationRule, deleteAutomationRule, toggleAutomationRule,
  listWebhooks, listWebhookLogs, createWebhook, updateWebhook, deleteWebhook,
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listFormulaFields, listRollupFields,
  createFormulaField, updateFormulaField, deleteFormulaField,
  createRollupField, updateRollupField, deleteRollupField,
} from './config';
import {
  listResourceAllocations, listResourceAnalyses, listImportJobs,
  getWorkbench, getWorkbenchConfig,
  createResourceAllocation, updateResourceAllocation, deleteResourceAllocation,
  listBaselines, createBaseline,
} from './resources';
import { listLLMSettings, listAIReports } from './aiSettings';

export const QUERY_TOOLS: ToolDefinition[] = [
  // 工作项核心
  getWorkItem,
  addWorkItemRelation,
  removeWorkItemRelation,

  // 系统管理
  listUsers,
  listSpaces,
  listSpaceMembers,
  getTenant,
  listAuditLogs,
  listSSOSettings,
  listSSOLogs,
  createSpace,
  updateSpace,
  addSpaceMember,
  removeSpaceMember,
  createUser,
  updateUser,
  resetUserPassword,
  createNotification,
  listFavorites,
  addFavorite,
  removeFavorite,
  listWorkHandovers,
  createWorkHandover,
  completeWorkHandover,

  // 项目实体
  getCustomer,
  listCarModels,
  getCarModel,
  deleteCustomer,
  deleteCarModel,
  deleteContact,
  getExternalDependency,
  createExternalDependency,
  updateExternalDependency,
  deleteExternalDependency,

  // 流程与评审
  listIterations,
  listFlows,
  getFlow,
  deleteIteration,
  deleteFlow,
  listReviews,
  getReview,
  createReview,
  finalizeReview,
  deleteComment,

  // 活动与测试
  listActivities,
  listTestCases,
  listTestPlans,
  listTestRuns,
  getTestRun,
  createTestCase,
  updateTestCase,
  createTestPlan,
  createTestRun,

  // 仪表盘与图表
  listDashboards,
  listCharts,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  createChart,
  updateChart,
  deleteChart,

  // 配置类
  listAutomationRules,
  listAutomationLogs,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  listWebhooks,
  listWebhookLogs,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listFormulaFields,
  listRollupFields,
  createFormulaField,
  updateFormulaField,
  deleteFormulaField,
  createRollupField,
  updateRollupField,
  deleteRollupField,

  // 资源与基线
  listResourceAllocations,
  listResourceAnalyses,
  listImportJobs,
  getWorkbench,
  getWorkbenchConfig,
  createResourceAllocation,
  updateResourceAllocation,
  deleteResourceAllocation,
  listBaselines,
  createBaseline,

  // AI 设置与报告
  listLLMSettings,
  listAIReports,
];
