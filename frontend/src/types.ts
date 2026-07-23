// AVM 前端类型定义（与后端 Prisma schema 对位）
// 使用 [key: string]: unknown 保持向后兼容，避免新增字段导致编译错误

// V1.8.3 资源管理
export interface ResourceAllocation {
  id: string;
  userId: string;
  userName: string;
  workItemId: string;
  workItemKey: string;
  workItemTitle: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  type: string;
  status: string;
  spaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ResourceLoadUser {
  userId: string;
  userName: string;
  totalHours: number;
  capacity?: number;
  activeCount?: number;
  overdueCount?: number;
  p0Count?: number;
  unassignedP0Count?: number;
  risks?: string[];
  suggestions?: string[];
  items: Array<{ workItemId?: string; workItemKey: string; workItemTitle: string; startDate: string; endDate: string; hours: number; type?: string; [key: string]: unknown }>;
  dailyHours: Record<string, number>;
  maxDaily: number;
  avgDaily: number;
  utilization: number;
  level: 'overload' | 'busy' | 'normal' | 'idle';
  [key: string]: unknown;
}
export type WorkItemType = 'requirement' | 'task' | 'bug' | 'release';

export interface WorkItem {
  id: string;
  type: WorkItemType;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  severity?: 'S0' | 'S1' | 'S2' | 'S3' | null;
  estimate?: number | null;
  actualHours?: number | null;
  storyPoints?: number | null;
  planStart?: string | null;
  planEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  assignee?: string | null;
  reporter: string;
  module?: string | null;
  labels: string;
  iterationId?: string | null;
  iteration?: { id: string; name: string; status: string } | null;
  projectId?: string | null;
  project?: { id: string; code: string; name: string; status?: string; billingType?: string } | null;
  customerId?: string | null;
  customer?: { id: string; code?: string; name: string; shortName?: string } | null;
  carModelId?: string | null;
  carModel?: { id: string; code?: string; name: string; brand?: string } | null;
  parentId?: string | null;
  parent?: { id: string; key: string; title: string; type: WorkItemType } | null;
  children?: Array<{ id: string; key: string; title: string; type: WorkItemType; status: string; assignee?: string | null; priority?: string }>;
  relatedFrom?: Array<{ id: string; relationType: string; to: { id: string; key: string; title: string; type: WorkItemType; status: string } }>;
  relatedTo?: Array<{ id: string; relationType: string; from: { id: string; key: string; title: string; type: WorkItemType; status: string } }>;
  comments?: Comment[];
  _count?: { children: number; comments: number };
  currentNodeId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface Iteration {
  id: string;
  name: string;
  goal: string;
  status: 'planning' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  _count?: { workItems: number };
  [key: string]: unknown;
}

export interface Comment {
  id: string;
  workItemId: string;
  author: string;
  authorId?: string;
  authorName?: string;
  content: string;
  imageUrl?: string | null;
  reactions?: Record<string, string[]>;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Activity {
  id: string;
  workItemId: string;
  actor: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  meta?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface MetaOptions {
  types: WorkItemType[];
  priority: string[];
  severity: string[];
  relationTypes: string[];
  statusByType: Record<string, { values: string[]; initial: string; terminal: string[] }>;
  assignees?: string[];
  modules?: string[];
  [key: string]: unknown;
}

export const TYPE_LABEL: Record<string, string> = {
  requirement: '需求',
  task: '任务',
  bug: '缺陷',
  release: '版本',
};

export const TYPE_COLOR: Record<string, string> = {
  requirement: 'blue',
  task: 'cyan',
  bug: 'red',
  release: 'purple',
};

export const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'orange',
  P2: 'blue',
  P3: 'default',
};

export const STATUS_COLOR: Record<string, string> = {
  待评审: 'default',
  已规划: 'cyan',
  开发中: 'blue',
  测试中: 'purple',
  验收中: 'magenta',
  已验收: 'green',
  已关闭: 'default',
  待领取: 'default',
  进行中: 'blue',
  自测中: 'cyan',
  已完成: 'green',
  待修复: 'orange',
  修复中: 'blue',
  待验证: 'purple',
  已驳回: 'red',
  规划中: 'default',
  集成中: 'blue',
  发布中: 'purple',
  已发布: 'green',
};

// ========== V1.1 流程引擎 ==========

export type FlowNodeType = 'normal' | 'start' | 'end' | 'review' | 'gate';

export interface FlowNode {
  id: string;
  flowId?: string;
  name: string;
  nodeType: FlowNodeType;
  description: string;
  positionX: number;
  positionY: number;
  statusValue?: string | null;
  roles: string;
  requiredFields: string;
  slaHours?: number | null;
  dodItems: string;
  reviewType?: string | null;
  reviewRule: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface FlowTransition {
  id: string;
  flowId?: string;
  fromNodeId: string;
  toNodeId: string;
  condition: string;
  label: string;
  isDefault: boolean;
  [key: string]: unknown;
}

export interface NodeFlow {
  id: string;
  name: string;
  workType: string;
  description: string;
  version: number;
  isActive: boolean;
  nodes?: FlowNode[];
  transitions?: FlowTransition[];
  _count?: { nodes: number; transitions: number };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== V1.1 评审 ==========

export interface ReviewParticipant {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  role: string;
  weight: number;
  hasResponded: boolean;
  respondedAt?: string | null;
  [key: string]: unknown;
}

export interface ReviewItem {
  id: string;
  reviewId: string;
  name: string;
  itemType: 'score' | 'check' | 'text';
  description: string;
  score?: number | null;
  maxScore: number;
  checked?: boolean | null;
  answer?: string | null;
  comment: string;
  completed: boolean;
  [key: string]: unknown;
}

export interface Review {
  id: string;
  workItemId: string;
  reviewType: string;
  title: string;
  status: string;
  conclusion?: string | null;
  summary: string;
  initiator: string;
  finalizer?: string | null;
  finalizedAt?: string | null;
  workItem?: { id: string; key: string; title: string; type: string; status: string };
  items?: ReviewItem[];
  participants?: ReviewParticipant[];
  _count?: { items: number; participants: number };
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  reviewType: string;
  description: string;
  items: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ========== V1.2 度量 ==========

export interface ChartConfig {
  id: string;
  name: string;
  chartType: string;
  source: string;
  dimensions: string;
  measures: string;
  filters: string;
  options: string;
  dashboardId?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  layout: string;
  scope: string;
  target?: string | null;
  charts?: ChartConfig[];
  _count?: { charts: number };
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ========== AI ==========

export interface AIFieldConfig {
  id: string;
  name: string;
  workType: string;
  targetField: string;
  capability: string;
  prompt: string;
  inputFields: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ========== 用户 ==========

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  department?: string | null;
  role: string;
  active: boolean;
  tenantId?: string;
  password?: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 甘特图 ==========
export interface GanttProject {
  id: string;
  code: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export interface GanttItem {
  id: string;
  key: string;
  title: string;
  type: WorkItemType | string;
  status: string;
  assignee?: string | null;
  planStart?: string | null;
  planEnd?: string | null;
  projectId?: string | null;
  [key: string]: unknown;
}

export interface GanttRelation {
  id: string;
  from: string;
  to: string;
  type: string;
}

export interface GanttData {
  projects: GanttProject[];
  items: GanttItem[];
  relations?: GanttRelation[];
  summary: Record<string, number>;
  dateRange: { from: string; to: string };
  [key: string]: unknown;
}

// ========== 燃尽图 ==========
export interface BurndownData {
  iteration: Iteration;
  daily: Array<{
    date: string;
    ideal: number;
    actual: number;
    completed: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ========== 迭代回顾 ==========
export interface RetrospectiveData {
  iteration: Iteration;
  summary: Record<string, number>;
  byAssignee: Record<string, Record<string, number>>;
  byType: Record<string, Record<string, number>>;
  report: string;
  [key: string]: unknown;
}

// ========== 通知 ==========
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: string;
  [key: string]: unknown;
}

// ========== 空间 ==========
export interface SpaceType {
  id: string;
  name: string;
  code: string;
  description?: string;
  [key: string]: unknown;
}

export interface SpaceMember {
  id: string;
  spaceId: string;
  userId: string;
  role: string;
  user?: { id: string; displayName: string; username: string };
  [key: string]: unknown;
}

// ========== 收藏 ==========
export interface Favorite {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  title: string;
  subtitle?: string;
  link: string;
  folder?: string;
  createdAt: string;
  [key: string]: unknown;
}

// ========== 客户/车型/联系人 ==========
export interface Customer {
  id: string;
  name: string;
  shortName?: string;
  code: string;
  contact?: string;
  phone?: string;
  status: string;
  [key: string]: unknown;
}

export interface CarModel {
  id: string;
  name: string;
  code: string;
  brand: string;
  customerId?: string;
  [key: string]: unknown;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

// ========== 项目 ==========
export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  customerId: string;
  carModelId: string;
  pmUserId: string;
  pmUserName: string;
  startDate: string;
  endDate: string;
  status: string;
  billingType: string;
  contractAmount: number;
  budgetHours: number;
  consumedHours: number;
  risk: string;
  progress: number;
  tags: string;
  createdBy: string;
  customer?: { id: string; name: string; shortName: string; code: string };
  carModel?: { id: string; name: string; code: string; brand: string };
  workItems?: WorkItem[];
  _count?: { workItems: number };
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ========== 树节点 ==========
export interface TreeNode {
  id: string;
  key: string;
  title: string;
  type: string;
  status?: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

// ========== 自动化 ==========
export interface AutomationRule {
  id: string;
  name: string;
  spaceId?: string;
  trigger: string;
  conditions?: string;
  actions: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== Webhook ==========
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  spaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 公式/聚合字段 ==========
export interface FormulaField {
  id: string;
  name: string;
  workType: string;
  formula: string;
  returnType: string;
  description?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface RollupField {
  id: string;
  name: string;
  workType: string;
  relationField: string;
  targetField: string;
  aggregateFn: string;
  description?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 模板 ==========
export interface WorkItemTemplate {
  id: string;
  name: string;
  workType: string;
  description?: string;
  content: string;
  spaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 外部依赖 ==========
export interface ExternalDependency {
  id: string;
  name: string;
  type: string;
  status: string;
  owner?: string;
  description?: string;
  workItemId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 测试用例/计划/执行 ==========
export interface TestCase {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  type: string;
  module?: string;
  steps?: string;
  expectedResult?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TestPlan {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TestRun {
  id: string;
  planId: string;
  status: string;
  executedBy?: string;
  executedAt?: string;
  result?: string;
  runnerId?: string;
  actualResult?: string;
  createdAt?: string;
  [key: string]: unknown;
}

// ========== SSO ==========
export interface SSOTenant {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SSOSetting {
  id: string;
  tenantId: string;
  provider: string;
  enabled: boolean;
  appId?: string;
  appSecret?: string;
  redirectUri?: string;
  corpId?: string;
  agentId?: string;
  config?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 审计日志 ==========
export interface AuditChange { field: string; oldValue: unknown; newValue: unknown; }
export interface AuditLog {
  id: string; entity: string; entityId: string; action: string;
  actor: string; actorRole?: string | null;
  changes?: string | null; meta?: string | null; createdAt: string;
  [key: string]: unknown;
}
export interface AuditMeta {
  entities: string[];
  actions: string[];
  actors: string[];
  [key: string]: unknown;
}

// ========== 工作台 ==========
export interface WorkbenchData {
  userId: string;
  metrics: Record<string, number>;
  myAssigned: WorkItem[];
  myCreated: WorkItem[];
  myInvolved: WorkItem[];
  myDue: WorkItem[];
  myOverdue: WorkItem[];
  myPendingReviews: Review[];
  myUnreadNotifs: Notification[];
  [key: string]: unknown;
}

// ========== 导入 ==========
export interface ImportResource {
  key: string;
  label: string;
  fields: { value: string; label: string; required?: boolean; hint?: string }[];
  [key: string]: unknown;
}
export interface ImportMapping {
  csvColumn: string;
  dbField: string;
}

// 补充 ImportJob.processed 字段
export interface ImportJob {
  id: string;
  name: string;
  resource: string;
  fileName?: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  processed?: number;
  errors?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ========== 资源分析 ==========
export interface ResourceAnalysisResult {
  startDate: string;
  endDate: string;
  users: ResourceLoadUser[];
  summary: Record<string, number>;
  risks: string[];
  suggestions: string[];
  [key: string]: unknown;
}

// ========== 基线 ==========
export interface Baseline {
  id: string;
  name: string;
  spaceId?: string;
  iterationId?: string;
  description?: string;
  snapshot: string;
  createdBy: string;
  createdAt: string;
  [key: string]: unknown;
}

// ========== LLM 设置 ==========
export interface LLMProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  isPrimary?: boolean;
  [key: string]: unknown;
}
export interface LLMSetting {
  provider: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  isPrimary?: boolean;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}
