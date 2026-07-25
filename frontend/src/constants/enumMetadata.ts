/**
 * 通用业务枚举元数据 (V1.46.2)
 *
 * 集中存放散落在各 CRUD 页面的 Record<string, string> 状态色/标签映射，
 * 消除拼写风险、便于全局调整。
 *
 * 工作项相关的 TYPE_LABEL / TYPE_COLOR / PRIORITY_COLOR / STATUS_COLOR
 * 仍在 types.ts 中维护（因为与工作项数据模型强耦合）。
 *
 * 这里只存放跨页面共享的实体状态枚举（客户/车型/项目/评审等）。
 */

// ===== 客户状态 =====
export const CUSTOMER_STATUS_COLOR: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  archived: 'red',
};

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  inactive: '停用',
  archived: '归档',
};

// ===== 客户类型 =====
export const CUSTOMER_TYPE_COLOR: Record<string, string> = {
  internal: 'blue',
  external: 'green',
};

export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  internal: '内部',
  external: '外部',
};

// ===== 联系人角色 =====
export const CONTACT_ROLE_COLOR: Record<string, string> = {
  UPL: 'red',
  PPM: 'blue',
  测试: 'orange',
  开发: 'purple',
  AVM接口人: 'cyan',
};

// ===== 车型状态（与 CarModelPage 对齐） =====
export const CAR_STATUS_COLOR: Record<string, string> = {
  active: 'green',
  discontinued: 'default',
  planning: 'blue',
};

export const CAR_STATUS_LABEL: Record<string, string> = {
  active: '在售',
  discontinued: '停售',
  planning: '规划中',
};

// ===== 车型级别（Segment） =====
export const CAR_SEGMENT_COLOR: Record<string, string> = {
  '紧凑型 SUV': 'blue',
  '中型 SUV': 'cyan',
  '中大型 SUV': 'geekblue',
  '紧凑型轿车': 'green',
  '中型轿车': 'lime',
  '中大型车': 'gold',
  '猎装轿跑': 'magenta',
  'MPV': 'purple',
  '微型车': 'orange',
};

// ===== 项目状态 =====
export const PROJECT_STATUS_COLOR: Record<string, string> = {
  planning: 'default',
  active: 'green',
  completed: 'blue',
  archived: 'orange',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

// ===== 项目计费类型 =====
export const PROJECT_BILLING_COLOR: Record<string, string> = {
  internal: 'blue',
  external: 'orange',
  po: 'cyan',
};

export const PROJECT_BILLING_LABEL: Record<string, string> = {
  internal: '内部',
  external: '外部',
  po: 'PO',
};

// ===== 项目风险等级 =====
export const PROJECT_RISK_COLOR: Record<string, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
};

export const PROJECT_RISK_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

// ===== 租户套餐 =====
export const TENANT_PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  enterprise: '企业版',
};

// ===== SSO Provider =====
export const SSO_PROVIDER_LABEL: Record<string, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  wechat_work: '企业微信',
  azure_ad: 'Azure AD',
  generic_oidc: '通用 OIDC',
};

// ===== 评审类型 =====
export const REVIEW_TYPE_COLOR: Record<string, string> = {
  design: 'blue',
  technical: 'cyan',
  test: 'orange',
  release: 'purple',
  milestone: 'magenta',
};

export const REVIEW_TYPE_LABEL: Record<string, string> = {
  design: '设计评审',
  technical: '技术评审',
  test: '测试评审',
  release: '发布评审',
  milestone: '里程碑评审',
};

// ===== 评审状态 =====
export const REVIEW_STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  in_review: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  in_review: '评审中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
};

// ===== 评审结论 =====
export const REVIEW_CONCLUSION_COLOR: Record<string, string> = {
  pass: 'green',
  conditional_pass: 'orange',
  fail: 'red',
};

export const REVIEW_CONCLUSION_LABEL: Record<string, string> = {
  pass: '通过',
  conditional_pass: '有条件通过',
  fail: '不通过',
};

// ===== 通知类型 =====
export const NOTIFICATION_TYPE_COLOR: Record<string, string> = {
  workitem: 'blue',
  review: 'cyan',
  test: 'orange',
  system: 'default',
  mention: 'magenta',
};

export const NOTIFICATION_LEVEL_COLOR: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
};

// ===== 审计操作类型 =====
export const AUDIT_ACTION_COLOR: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'cyan',
  logout: 'default',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  login: '登录',
  logout: '登出',
};
