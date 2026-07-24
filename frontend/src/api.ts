import axios, { AxiosInstance } from 'axios';
import type {
  WorkItem, Iteration, Comment, Activity, MetaOptions, WorkItemType,
  NodeFlow, Review, ReviewTemplate, ChartConfig,
  Dashboard, AIFieldConfig, User, GanttData, BurndownData, RetrospectiveData,
  SpaceType, SpaceMember, Notification, Favorite, ResourceAllocation,
  ResourceLoadUser, Customer, CarModel, Contact, Project, ExternalDependency,
  FormulaField, RollupField, WorkItemTemplate, TreeNode, AutomationRule,
  WebhookConfig, ImportJob, ResourceAnalysisResult, Baseline,
  TestCase, TestPlan, TestRun, SSOTenant, SSOSetting,
  AuditChange, AuditLog, AuditMeta, WorkbenchData, ImportResource, ImportMapping,
  LLMProvider, LLMSetting,
} from './types';

export type {
  WorkItem, Iteration, Comment, Activity, MetaOptions, WorkItemType,
  NodeFlow, Review, ReviewTemplate, ChartConfig,
  Dashboard, AIFieldConfig, User, GanttData, BurndownData, RetrospectiveData,
  SpaceType, SpaceMember, Notification, Favorite, ResourceAllocation,
  ResourceLoadUser, Customer, CarModel, Contact, Project, ExternalDependency,
  FormulaField, RollupField, WorkItemTemplate, TreeNode, AutomationRule,
  WebhookConfig, ImportJob, ResourceAnalysisResult, Baseline,
  TestCase, TestPlan, TestRun, SSOTenant, SSOSetting,
  AuditChange, AuditLog, AuditMeta, WorkbenchData, ImportResource, ImportMapping,
  LLMProvider, LLMSetting,
};

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// V1.30.3 P1-2: LLM 工具链使用独立长超时实例（60s），避免普通接口被拖累
export const llmApi = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// V1.30.3 P0-8: axios 拦截器 — 自动注入 token + 401 跳登录
function attachAuthInterceptor(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    try {
      const raw = localStorage.getItem('avm-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      }
    } catch { /* ignore */ }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error?.response?.status === 401) {
        localStorage.removeItem('avm-auth');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?expired=1';
        }
      }
      return Promise.reject(error);
    },
  );
}
attachAuthInterceptor(api);
attachAuthInterceptor(llmApi);

type AnyData = Record<string, unknown>;
type AnyParams = Record<string, unknown>;

export const workItemApi = {
  list: (params?: AnyParams) => api.get<WorkItem[]>('/work-items', { params }).then(r => r.data),
  get: (id: string) => api.get<WorkItem>(`/work-items/${id}`).then(r => r.data),
  create: (data: AnyData & { type: WorkItemType }) => api.post<WorkItem>('/work-items', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<WorkItem>(`/work-items/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/work-items/${id}`).then(r => r.data),
  bulkStatus: (ids: string[], status: string, actor = '我') => api.post('/work-items/bulk-status', { ids, status, actor }).then(r => r.data),
  batchUpdate: (ids: string[], changes: AnyData) => api.post<{ updated: number; requested: number; found: number; changes: AnyData }>('/work-items/batch-update', { ids, changes }).then(r => r.data),
  addRelation: (id: string, toId: string, relationType: string) => api.post(`/work-items/${id}/relations`, { toId, relationType }).then(r => r.data),
  removeRelation: (id: string, relId: string) => api.delete(`/work-items/${id}/relations/${relId}`).then(r => r.data),
  gantt: (params?: AnyParams) => api.get<GanttData>('/work-items/gantt', { params }).then(r => r.data),
  estimateHistory: (id: string) => api.get<{ workItemId: string; points: Array<{ date: string; estimate: number | null; actualHours: number | null; action: string }> }>(`/work-items/${id}/estimate-history`).then(r => r.data),
  workloadByUser: (params?: AnyParams) => api.get<{ byUser: Array<{ user: string; totalEstimate: number; totalActual: number; itemCount: number; doneCount: number; overdueCount: number }>; totalItems: number }>('/work-items/workload-by-user', { params }).then(r => r.data),
};

export const iterationApi = {
  list: () => api.get<Iteration[]>('/iterations').then(r => r.data),
  get: (id: string) => api.get<Iteration>(`/iterations/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Iteration>('/iterations', data).then(r => r.data),
  burndown: (id: string) => api.get<BurndownData>(`/iterations/${id}/burndown`).then(r => r.data),
  retrospective: (id: string) => api.get<RetrospectiveData>(`/iterations/${id}/retrospective`).then(r => r.data),
};

export const commentApi = {
  create: (workItemId: string, content: string, author = '我', imageUrl?: string) => api.post<Comment>('/comments', { workItemId, content, author, imageUrl }).then(r => r.data),
  delete: (id: string) => api.delete(`/comments/${id}`).then(r => r.data),
  react: (id: string, emoji: string, user: string) => api.post<{ ok: boolean; reactions: Record<string, string[]>; action: 'added' | 'removed' }>(`/comments/${id}/react`, { emoji, user }).then(r => r.data),
};

export const mentionApi = {
  search: (q: string) => api.get<Array<{ id: string; username: string; displayName: string; department?: string; role: string; mentionText: string; avatarColor: string }>>('/mentions/search', { params: { q, limit: 10 } }).then(r => r.data),
};

export const activityApi = {
  list: (workItemId?: string, limit = 50) => api.get<Activity[]>('/activities', { params: { workItemId, limit } }).then(r => r.data),
};

export const metaApi = {
  options: () => api.get<MetaOptions>('/meta/options').then(r => r.data),
  assignees: () => api.get<string[]>('/meta/assignees').then(r => r.data),
  modules: () => api.get<string[]>('/meta/modules').then(r => r.data),
  health: (by: string = 'customer') => api.get<{ by: string; items: Array<Record<string, unknown>> }>(`/meta/health?by=${by}`).then(r => r.data),
  stats: () => api.get<{ total: number; byType: Record<string, number>; byStatus: Record<string, number>; byPriority: Record<string, number> }>('/meta/stats').then(r => r.data),
};

export const flowApi = {
  list: () => api.get<NodeFlow[]>('/flows').then(r => r.data),
  get: (id: string) => api.get<NodeFlow>(`/flows/${id}`).then(r => r.data),
  getActiveByType: (workType: string) => api.get<NodeFlow>(`/flows/active/${workType}`).then(r => r.data),
  create: (data: AnyData) => api.post<NodeFlow>('/flows', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<NodeFlow>(`/flows/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/flows/${id}`).then(r => r.data),
  transition: (workItemId: string, toNodeId: string, actor = '我', comment?: string) => api.post(`/flows/transition/${workItemId}`, { toNodeId, actor, comment }).then(r => r.data),
  getAvailableTransitions: (workItemId: string) => api.get(`/flows/transitions/${workItemId}`).then(r => r.data),
};

export const reviewApi = {
  list: (workItemId?: string) => api.get<Review[]>('/reviews', { params: { workItemId } }).then(r => r.data),
  get: (id: string) => api.get<Review>(`/reviews/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Review>('/reviews', data).then(r => r.data),
  submit: (id: string, userId: string, submissions: AnyData[]) => api.post(`/reviews/${id}/submit`, { userId, submissions }).then(r => r.data),
  finalize: (id: string, data: AnyData) => api.post(`/reviews/${id}/finalize`, data).then(r => r.data),
  listTemplates: () => api.get<ReviewTemplate[]>('/reviews/templates/all').then(r => r.data),
  createTemplate: (data: AnyData) => api.post<ReviewTemplate>('/reviews/templates', data).then(r => r.data),
};

export const chartApi = {
  list: (dashboardId?: string) => api.get<ChartConfig[]>('/charts', { params: { dashboardId } }).then(r => r.data),
  get: (id: string) => api.get<ChartConfig>(`/charts/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<ChartConfig>('/charts', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<ChartConfig>(`/charts/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/charts/${id}`).then(r => r.data),
  compute: (id: string, filters?: AnyData[]) => api.post(`/charts/${id}/compute`, { filters }).then(r => r.data),
  preview: (config: AnyData) => api.post('/charts/preview', config).then(r => r.data),
};

export const dashboardApi = {
  list: () => api.get<Dashboard[]>('/dashboards').then(r => r.data),
  get: (id: string) => api.get<Dashboard>(`/dashboards/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Dashboard>('/dashboards', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<Dashboard>(`/dashboards/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/dashboards/${id}`).then(r => r.data),
};

export const aiApi = {
  // LLM 调用类接口统一走 llmApi（60s 超时）
  suggestEstimate: (data: AnyData) => llmApi.post('/ai/suggest-estimate', data).then(r => r.data),
  classifyBug: (data: AnyData) => llmApi.post('/ai/classify-bug', data).then(r => r.data),
  aiCommand: (command: string, context?: AnyData) => llmApi.post('/ai-command/command', { command, context }).then(r => r.data),
  aiTools: () => llmApi.get('/ai-command/tools').then(r => r.data),
  aiSuggestions: (page: string) => llmApi.post('/ai-command/suggestions', { page }).then(r => r.data),
  aiFillWorkItem: (data: AnyData) => llmApi.post('/ai-command/fill-work-item', data).then(r => r.data),
  aiSuggestAssignee: (data: AnyData) => llmApi.post('/ai-command/suggest-assignee', data).then(r => r.data),
  aiRiskScan: () => llmApi.post('/ai-command/risk-scan', {}).then(r => r.data),
  aiFillForm: (formType: string, data: AnyData) => llmApi.post('/ai-command/fill-form', { formType, ...data }).then(r => r.data),
  createFollowUp: (notificationId: string, data?: AnyData) => llmApi.post(`/ai-command/notifications/${notificationId}/create-follow-up`, data || {}).then(r => r.data),
  weeklyReport: (params?: AnyParams) => llmApi.get('/ai-command/weekly-report', { params }).then(r => r.data),
  monthlyReport: (params?: AnyParams) => llmApi.get('/ai-command/monthly-report', { params }).then(r => r.data),
  latestReport: (params?: AnyParams) => llmApi.get('/ai-command/reports/latest', { params }).then(r => r.data),
  listReports: (params?: AnyParams) => llmApi.get('/ai-command/reports/list', { params }).then(r => r.data),
  report: (endpoint: string, params?: AnyParams) => llmApi.get(`/ai-command${endpoint}`, { params }).then(r => r.data),
  // 导出/配置/状态类接口保持 api（15s 超时）
  exportWorkItems: (params?: AnyParams) => api.get('/export/work-items', { params, responseType: 'blob' }).then(r => r.data),
  exportProjects: (params?: AnyParams) => api.get('/export/projects', { params, responseType: 'blob' }).then(r => r.data),
  exportCustomers: (params?: AnyParams) => api.get('/export/customers', { params, responseType: 'blob' }).then(r => r.data),
  exportCarModels: (params?: AnyParams) => api.get('/export/car-models', { params, responseType: 'blob' }).then(r => r.data),
  exportRisks: (params?: AnyParams) => api.get('/export/risks', { params, responseType: 'blob' }).then(r => r.data),
  suggestPriority: (data: AnyData) => llmApi.post('/ai/suggest-priority', data).then(r => r.data),
  assessRisk: (workItemId: string) => llmApi.post(`/ai/assess-risk/${workItemId}`, {}).then(r => r.data),
  decompose: (workItemId: string) => llmApi.post<{ ok: boolean; llmModel: string | null; parent: WorkItem; subtasks: WorkItem[]; note?: string }>('/ai/decompose', { workItemId }).then(r => r.data),
  qa: (question: string) => llmApi.post('/ai/qa', { question }).then(r => r.data),
  listConfigs: () => api.get<AIFieldConfig[]>('/ai/configs').then(r => r.data),
  createConfig: (data: AnyData) => api.post<AIFieldConfig>('/ai/configs', data).then(r => r.data),
  updateConfig: (id: string, data: AnyData) => api.patch<AIFieldConfig>(`/ai/configs/${id}`, data).then(r => r.data),
  deleteConfig: (id: string) => api.delete(`/ai/configs/${id}`).then(r => r.data),
  logs: (limit = 50) => api.get('/ai/logs', { params: { limit } }).then(r => r.data),
  llmStatus: () => api.get('/ai/llm-status').then(r => r.data),
  // V1.31 P1-4: 手动刷新 Wiki 知识快照缓存
  refreshWiki: () => llmApi.post('/ai-command/refresh-wiki', {}).then(r => r.data),
};

export const userApi = {
  list: () => api.get<User[]>('/users').then(r => r.data),
  create: (data: AnyData) => api.post<User>('/users', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<User>(`/users/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/users/${id}`).then(r => r.data),
  login: (username: string, password: string) => api.post('/users/login', { username, password }).then(r => r.data),
};

export const auditApi = {
  list: (params?: AnyParams) => api.get<{ items: AuditLog[]; total: number; limit: number; offset: number }>('/audit-logs', { params }).then(r => r.data),
  stats: (days = 7) => api.get<{ total: number; byEntity: Record<string, number>; byAction: Record<string, number>; byActor: Record<string, number>; topActors: [string, number][] }>(`/audit-logs/stats?days=${days}`).then(r => r.data),
  get: (id: string) => api.get<AuditLog>(`/audit-logs/${id}`).then(r => r.data),
  byEntity: (entity: string, entityId: string) => api.get<AuditLog[]>(`/audit-logs/by-entity/${entity}/${entityId}`).then(r => r.data),
};

export const spaceApi = {
  list: () => api.get<SpaceType[]>('/spaces').then(r => r.data),
  get: (id: string) => api.get<SpaceType>(`/spaces/${id}`).then(r => r.data),
  mySpaces: (userId: string) => api.get<SpaceType[]>(`/spaces/me/${userId}`).then(r => r.data),
  members: (id: string) => api.get<SpaceMember[]>(`/spaces/${id}/members`).then(r => r.data),
  addMember: (id: string, data: AnyData) => api.post(`/spaces/${id}/members`, data).then(r => r.data),
};

export const notificationApi = {
  list: (userId: string, filter = 'all') => api.get<Notification[]>('/notifications', { params: { userId, filter } }).then(r => r.data),
  unreadCount: (userId: string) => api.get<{ count: number }>('/notifications/unread-count', { params: { userId } }).then(r => r.data),
  markRead: (id: string) => api.post(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: (userId: string) => api.post('/notifications/read-all', { userId }).then(r => r.data),
  scanDue: () => api.post('/notifications/scan-due').then(r => r.data),
};

export const favoriteApi = {
  list: (userId: string, folder?: string) => api.get<Favorite[]>('/favorites', { params: { userId, folder } }).then(r => r.data),
  add: (data: AnyData) => api.post<Favorite>('/favorites', data).then(r => r.data),
  remove: (id: string) => api.delete(`/favorites/${id}`).then(r => r.data),
  removeByResource: (userId: string, resourceType: string, resourceId: string) => api.delete('/favorites', { params: { userId, resourceType, resourceId } }).then(r => r.data),
};

export const resourceApi = {
  allocations: (params?: AnyParams) => api.get<ResourceAllocation[]>('/resources/allocations', { params }).then(r => r.data),
  load: (startDate: string, endDate: string, spaceId?: string) => api.get<{ startDate?: string; endDate?: string; workingDays: string[]; users: ResourceLoadUser[] }>('/resources/load', { params: { startDate, endDate, spaceId } }).then(r => r.data),
  myAllocations: (userId: string) => api.get<{ allocations: ResourceAllocation[]; totalHours: number }>(`/resources/by-user/${userId}`).then(r => r.data),
  createAllocation: (data: AnyData) => api.post<ResourceAllocation>('/resources/allocations', data).then(r => r.data),
  deleteAllocation: (id: string) => api.delete(`/resources/allocations/${id}`).then(r => r.data),
};

export const searchApi = {
  search: (q: string, type?: string) => api.get<{ q: string; total: number; results: Array<{ type: string; title: string; subtitle?: string; link: string }> }>('/search', { params: { q, type } }).then(r => r.data),
  suggest: (q: string) => api.get<Array<{ id: string; title: string; type: string }>>('/search/suggest', { params: { q } }).then(r => r.data),
};

export const workbenchApi = {
  me: (userId: string) => api.get<WorkbenchData>('/workbench/me', { params: { userId } }).then(r => r.data),
  team: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/workbench/team', { params }).then(r => r.data),
  getLayout: (userId: string) => api.get<Record<string, unknown>>(`/workbench/layout/${userId}`).then(r => r.data),
  saveLayout: (userId: string, data: AnyData) => api.post(`/workbench/layout/${userId}`, data).then(r => r.data),
};

export const fieldApi = {
  formulas: (params?: AnyParams) => api.get<FormulaField[]>('/fields/formulas', { params }).then(r => r.data),
  createFormula: (data: AnyData) => api.post<FormulaField>('/fields/formulas', data).then(r => r.data),
  updateFormula: (id: string, data: AnyData) => api.patch<FormulaField>(`/fields/formulas/${id}`, data).then(r => r.data),
  deleteFormula: (id: string) => api.delete(`/fields/formulas/${id}`).then(r => r.data),
  recomputeFormula: (id: string) => api.post(`/fields/formulas/${id}/recompute`).then(r => r.data),
  rollups: (params?: AnyParams) => api.get<RollupField[]>('/fields/rollups', { params }).then(r => r.data),
  createRollup: (data: AnyData) => api.post<RollupField>('/fields/rollups', data).then(r => r.data),
  updateRollup: (id: string, data: AnyData) => api.patch<RollupField>(`/fields/rollups/${id}`, data).then(r => r.data),
  deleteRollup: (id: string) => api.delete(`/fields/rollups/${id}`).then(r => r.data),
  derived: (workItemId: string) => api.get<{ formulas: Record<string, unknown>; rollups: Record<string, unknown> }>(`/fields/derived/${workItemId}`).then(r => r.data),
  testFormula: (formula: string, sample: AnyData) => api.post('/fields/test-formula', { formula, sample }).then(r => r.data),
  validateFormula: (formula: string) => api.post('/fields/validate', { formula }).then(r => r.data),
  recomputeAll: (spaceId?: string) => api.post('/fields/recompute-all', { spaceId }).then(r => r.data),
  meta: () => api.get<{ fields: string[]; numberFunctions: string[]; stringFunctions: string[]; dateFunctions: string[] }>('/fields/meta').then(r => r.data),
};

export const templateApi = {
  list: (params?: AnyParams) => api.get<WorkItemTemplate[]>('/templates', { params }).then(r => r.data),
  get: (id: string) => api.get<WorkItemTemplate>(`/templates/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<WorkItemTemplate>('/templates', data).then(r => r.data),
  apply: (id: string, data: AnyData) => api.post(`/templates/${id}/apply`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/templates/${id}`).then(r => r.data),
};

export const treeApi = {
  get: (params?: AnyParams) => api.get<TreeNode[]>('/tree', { params }).then(r => r.data),
  stats: (params?: AnyParams) => api.get<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }>('/tree/stats', { params }).then(r => r.data),
};

export const automationApi = {
  rules: (params?: AnyParams) => api.get<AutomationRule[]>('/automation/rules', { params }).then(r => r.data),
  get: (id: string) => api.get<AutomationRule>(`/automation/rules/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<AutomationRule>('/automation/rules', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<AutomationRule>(`/automation/rules/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/automation/rules/${id}`).then(r => r.data),
  toggle: (id: string) => api.post(`/automation/rules/${id}/toggle`).then(r => r.data),
  run: (id: string, context: AnyData) => api.post(`/automation/rules/${id}/run`, { context }).then(r => r.data),
  test: (id: string, context: AnyData) => api.post(`/automation/rules/${id}/test`, { context }).then(r => r.data),
  meta: {
    triggers: () => api.get<Array<{ key: string; label: string; description: string }>>('/automation/meta/triggers').then(r => r.data),
    conditions: () => api.get<Array<{ key: string; label: string; description: string }>>('/automation/meta/conditions').then(r => r.data),
    actions: () => api.get<Array<{ key: string; label: string; description: string }>>('/automation/meta/actions').then(r => r.data),
  },
  logs: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/automation/logs', { params }).then(r => r.data),
};

export const webhookApi = {
  configs: (params?: AnyParams) => api.get<WebhookConfig[]>('/webhooks/configs', { params }).then(r => r.data),
  get: (id: string) => api.get<WebhookConfig>(`/webhooks/configs/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<WebhookConfig>('/webhooks/configs', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<WebhookConfig>(`/webhooks/configs/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/webhooks/configs/${id}`).then(r => r.data),
  test: (id: string, payload?: AnyData) => api.post(`/webhooks/configs/${id}/test`, { payload }).then(r => r.data),
  logs: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/webhooks/logs', { params }).then(r => r.data),
};

export const importApi = {
  resources: () => api.get<{ resources: ImportResource[]; aliases: Record<string, string[]> }>('/imports/resources').then(r => r.data),
  templateUrl: (resource: string) => `/api/imports/template/${resource}`,
  preview: (formData: FormData) => api.post<{ columns: string[]; rows: AnyData[]; total: number; mapping: ImportMapping[]; resource: string; fileName: string }>('/imports/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  previewJson: (resource: string, csvText: string) => api.post<{ columns: string[]; rows: AnyData[]; total: number; mapping: ImportMapping[]; resource: string; fileName: string }>('/imports/preview', { resource, csvText }).then(r => r.data),
  execute: (data: AnyData) => api.post<{ job: ImportJob; result: { total: number; succeeded: number; failed: number; errors: string[] } }>('/imports/execute', data).then(r => r.data),
  jobs: (params?: AnyParams) => api.get<ImportJob[]>('/imports/jobs', { params }).then(r => r.data),
  get: (id: string) => api.get<ImportJob>(`/imports/jobs/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<ImportJob>('/imports/jobs', data).then(r => r.data),
  parseCsv: (csv: string) => api.post<{ rows: AnyData[]; total: number; columns: string[] }>('/imports/parse-csv', { csv }).then(r => r.data),
};

export const uploadApi = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ ok: boolean; url: string; filename: string; originalName: string; size: number; mimetype: string }>('/uploads', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

export const handoverApi = {
  list: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/handover', { params }).then(r => r.data),
  preview: (userId: string) => api.get<{ workItems: WorkItem[]; reviews: Review[] }>(`/handover/preview/${userId}`).then(r => r.data),
  execute: (data: AnyData) => api.post<{ ok: boolean; transferred: number }>('/handover', data).then(r => r.data),
};

export const resourceAnalysisApi = {
  analyze: (startDate: string, endDate: string, spaceId?: string) => api.post<ResourceAnalysisResult>('/analysis/analyze', { startDate, endDate, spaceId }).then(r => r.data),
  history: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/analysis/history', { params }).then(r => r.data),
  teamOverview: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/analysis/team-overview', { params }).then(r => r.data),
};

export const baselineApi = {
  list: (params?: AnyParams) => api.get<Baseline[]>('/baselines', { params }).then(r => r.data),
  get: (id: string) => api.get<Baseline>(`/baselines/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Baseline>('/baselines', data).then(r => r.data),
  compare: (id: string) => api.get<{ baseline: Baseline; changes: Record<string, unknown>; stats: Record<string, number> }>(`/baselines/${id}/compare`).then(r => r.data),
  remove: (id: string) => api.delete(`/baselines/${id}`).then(r => r.data),
};

export const mcpApi = {
  info: () => api.get<Record<string, unknown>>('/mcp').then(r => r.data),
  tools: () => api.get<{ tools: Array<{ name: string; description: string }> }>('/mcp/tools').then(r => r.data),
  call: (name: string, args: AnyData) => api.post<{ tool: string; args: Record<string, unknown>; result: unknown }>(`/mcp/tools/${name}`, args).then(r => r.data),
  resources: () => api.get<{ resources: Array<{ uri: string; name: string }> }>('/mcp/resources').then(r => r.data),
  promptTemplates: () => api.get<{ templates: Array<{ name: string; description: string }> }>('/mcp/prompt-templates').then(r => r.data),
};

export const testApi = {
  cases: (params?: AnyParams) => api.get<TestCase[]>('/tests/cases', { params }).then(r => r.data),
  getCase: (id: string) => api.get<TestCase>(`/tests/cases/${id}`).then(r => r.data),
  createCase: (data: AnyData) => api.post<TestCase>('/tests/cases', data).then(r => r.data),
  updateCase: (id: string, data: AnyData) => api.patch<TestCase>(`/tests/cases/${id}`, data).then(r => r.data),
  removeCase: (id: string) => api.delete(`/tests/cases/${id}`).then(r => r.data),
  addCaseBug: (caseId: string, data: AnyData) => api.post(`/tests/cases/${caseId}/bugs`, data).then(r => r.data),
  removeCaseBug: (caseId: string, bugId: string) => api.delete(`/tests/cases/${caseId}/bugs/${bugId}`).then(r => r.data),
  plans: (params?: AnyParams) => api.get<TestPlan[]>('/tests/plans', { params }).then(r => r.data),
  getPlan: (id: string) => api.get<TestPlan>(`/tests/plans/${id}`).then(r => r.data),
  createPlan: (data: AnyData) => api.post<TestPlan>('/tests/plans', data).then(r => r.data),
  updatePlan: (id: string, data: AnyData) => api.patch<TestPlan>(`/tests/plans/${id}`, data).then(r => r.data),
  removePlan: (id: string) => api.delete(`/tests/plans/${id}`).then(r => r.data),
  addCasesToPlan: (id: string, data: AnyData) => api.post(`/tests/plans/${id}/cases`, data).then(r => r.data),
  removeCaseFromPlan: (id: string, caseId: string) => api.delete(`/tests/plans/${id}/cases/${caseId}`).then(r => r.data),
  updatePlanCase: (id: string, caseId: string, data: AnyData) => api.patch(`/tests/plans/${id}/cases/${caseId}`, data).then(r => r.data),
  runs: (params?: AnyParams) => api.get<TestRun[]>('/tests/runs', { params }).then(r => r.data),
  createRun: (planId: string, data: AnyData) => api.post<TestRun>(`/tests/plans/${planId}/runs`, data).then(r => r.data),
  updateRun: (id: string, data: AnyData) => api.patch<TestRun>(`/tests/runs/${id}`, data).then(r => r.data),
  stats: () => api.get<Record<string, number>>('/tests/stats').then(r => r.data),
};

export const ssoApi = {
  listTenants: () => api.get<SSOTenant[]>('/sso/tenants').then(r => r.data),
  createTenant: (data: AnyData) => api.post<SSOTenant>('/sso/tenants', data).then(r => r.data),
  updateTenant: (id: string, data: AnyData) => api.patch<SSOTenant>(`/sso/tenants/${id}`, data).then(r => r.data),
  deleteTenant: (id: string) => api.delete(`/sso/tenants/${id}`),
  tenantStats: (id: string) => api.get<Record<string, number>>(`/sso/tenants/${id}/stats`).then(r => r.data),
  getSettings: (tenantId: string) => api.get<SSOSetting[]>(`/sso/tenants/${tenantId}/settings`).then(r => r.data),
  upsertSetting: (tenantId: string, provider: string, data: AnyData) => api.put<SSOSetting>(`/sso/tenants/${tenantId}/settings/${provider}`, data).then(r => r.data),
  deleteSetting: (tenantId: string, provider: string) => api.delete(`/sso/tenants/${tenantId}/settings/${provider}`),
  feishuLoginUrl: (params?: AnyParams) => api.get<{ authUrl: string; state: string }>(`/sso/oauth/feishu/login`, { params }).then(r => r.data),
  demoLogin: (provider: string, data: AnyData) => api.post<{ token: string; user: User }>(`/sso/oauth/${provider}/demo-login`, data).then(r => r.data),
  logs: (params?: AnyParams) => api.get<Array<Record<string, unknown>>>('/sso/logs', { params }).then(r => r.data),
};

export const llmSettingsApi = {
  list: () => api.get<{ providers: string[]; settings: Record<string, unknown>[]; status: Record<string, unknown>; activeProviders?: string[] }>('/llm-settings').then(r => r.data),
  get: (provider: string) => api.get<Record<string, unknown>>(`/llm-settings/${provider}`).then(r => r.data),
  upsert: (provider: string, data: AnyData) => api.put<Record<string, unknown>>(`/llm-settings/${provider}`, data).then(r => r.data),
  remove: (provider: string) => api.delete(`/llm-settings/${provider}`),
  test: (provider: string, data: AnyData) => api.post<{ ok: boolean; message: string; success?: boolean; latencyMs?: number }>(`/llm-settings/${provider}/test`, data).then(r => r.data),
  setPrimary: (provider: string) => api.post<{ ok: boolean }>(`/llm-settings/${provider}/primary`).then(r => r.data),
  testChat: (data: AnyData) => api.post<{ ok: boolean; response: string; success?: boolean; latencyMs?: number; message?: string }>(`/llm-settings/test-chat`, data).then(r => r.data),
  listModels: (provider: string) => api.get<{ builtin: string[]; builtinAll: string[]; custom: string[]; current: string; all: string[] }>(`/llm-settings/${provider}/models`).then(r => r.data),
  switchModel: (provider: string, model: string) => api.post<{ ok: boolean; model: string; provider: string; currentModel: string; displayName: string; status: Record<string, unknown> }>(`/llm-settings/${provider}/switch-model`, { model }).then(r => r.data),
  activateProvider: (provider: string) => api.post<{ ok: boolean; provider: string; displayName: string; model: string; status: Record<string, unknown> }>(`/llm-settings/${provider}/activate`, {}).then(r => r.data),
  // V1.31: 一键厂商+模型切换（自动设主 provider、currentModel）
  quickSwitch: (provider: string, model?: string) => api.post<{ ok: boolean; provider: string; model: string; displayName: string; status: Record<string, unknown> }>(`/llm-settings/quick-switch`, { provider, ...(model ? { model } : {}) }).then(r => r.data),
  addCustomModel: (provider: string, model: string) => api.post<{ ok: boolean }>(`/llm-settings/${provider}/custom-models`, { model }).then(r => r.data),
  removeCustomModel: (provider: string, model: string) => api.delete<{ ok: boolean }>(`/llm-settings/${provider}/custom-models/${encodeURIComponent(model)}`).then(r => r.data),
};

export const customerApi = {
  list: (params?: AnyParams) => api.get<Customer[]>('/customers', { params }).then(r => r.data),
  get: (id: string) => api.get<Customer>(`/customers/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Customer>('/customers', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<Customer>(`/customers/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/customers/${id}`).then(r => r.data),
  stats: () => api.get<Record<string, number>>('/customers/_stats/summary').then(r => r.data),
};

export const carModelApi = {
  list: (params?: AnyParams) => api.get<CarModel[]>('/car-models', { params }).then(r => r.data),
  get: (id: string) => api.get<CarModel>(`/car-models/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<CarModel>('/car-models', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<CarModel>(`/car-models/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/car-models/${id}`).then(r => r.data),
  byBrand: () => api.get<Record<string, number>>('/car-models/_stats/by-brand').then(r => r.data),
};

export const contactApi = {
  list: (params?: AnyParams) => api.get<Contact[]>('/contacts', { params }).then(r => r.data),
  get: (id: string) => api.get<Contact>(`/contacts/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Contact>('/contacts', data).then(r => r.data),
  batch: (contacts: AnyData[]) => api.post<{ created: number }>('/contacts/batch', { contacts }).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<Contact>(`/contacts/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/contacts/${id}`).then(r => r.data),
};

export const projectApi = {
  list: (params?: AnyParams) => api.get<Project[]>('/projects', { params }).then(r => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<Project>(`/projects/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/projects/${id}`).then(r => r.data),
  stats: () => api.get<Record<string, number>>('/projects/_stats/summary').then(r => r.data),
};

export const dependencyApi = {
  list: (params?: AnyParams) => api.get<ExternalDependency[]>('/dependencies', { params }).then(r => r.data),
  get: (id: string) => api.get<ExternalDependency>(`/dependencies/${id}`).then(r => r.data),
  create: (data: AnyData) => api.post<ExternalDependency>('/dependencies', data).then(r => r.data),
  update: (id: string, data: AnyData) => api.patch<ExternalDependency>(`/dependencies/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/dependencies/${id}`).then(r => r.data),
  ready: (id: string) => api.post(`/dependencies/${id}/ready`, {}).then(r => r.data),
  stats: () => api.get<Record<string, number>>('/dependencies/stats/summary').then(r => r.data),
};
