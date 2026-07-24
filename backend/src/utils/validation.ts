/**
 * P2-2: 输入验证 schema (基于 zod)
 * 用于核心路由的请求体校验
 */
import { z } from 'zod';

// ============ 工作项验证 ============
export const workItemCreateSchema = z.object({
  type: z.enum(['requirement', 'task', 'bug', 'release']),
  title: z.string().min(1, '标题不能为空').max(200, '标题最长 200 字符'),
  description: z.string().max(10000, '描述最长 10000 字符').optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  severity: z.enum(['S1', 'S2', 'S3', 'S4']).optional(),
  assignee: z.string().max(50).optional(),
  reporter: z.string().max(50).optional(),
  module: z.string().max(100).optional(),
  labels: z.array(z.string()).optional(),
  iterationId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  carModelId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  parentId: z.string().max(100).nullable().optional(),
  estimate: z.number().min(0).max(10000).nullable().optional(),
  planStart: z.coerce.date().nullable().optional(),
  planEnd: z.coerce.date().nullable().optional(),
});

export const workItemUpdateSchema = workItemCreateSchema.partial().extend({
  status: z.string().max(50).optional(),
  actualHours: z.number().min(0).max(10000).nullable().optional(),
  actualStart: z.coerce.date().nullable().optional(),
  actualEnd: z.coerce.date().nullable().optional(),
  // V1.46: 允许 null 值（前端清空字段时会传 null）
  assignee: z.string().max(50).nullable().optional(),
  reporter: z.string().max(50).nullable().optional(),
  module: z.string().max(100).nullable().optional(),
  labels: z.array(z.string()).nullable().optional(),
  title: z.string().min(1, '标题不能为空').max(200, '标题最长 200 字符').nullable().optional(),
  description: z.string().max(10000, '描述最长 10000 字符').nullable().optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).nullable().optional(),
  severity: z.enum(['S1', 'S2', 'S3', 'S4']).nullable().optional(),
});

// ============ 项目验证 ============
export const projectCreateSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(200),
  code: z.string().min(1, '项目编码不能为空').max(50),
  spaceId: z.string().uuid().nullable().optional(),
  pmUserId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  carModelId: z.string().uuid().nullable().optional(),
  billingType: z.enum(['ODC', 'ODM', '固定价']).optional(),
  contractAmount: z.number().min(0).nullable().optional(),
  budgetHours: z.number().min(0).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  description: z.string().max(5000).optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: z.string().max(50).optional(),
  risk: z.string().max(50).optional(),
  progress: z.number().min(0).max(100).nullable().optional(),
  consumedHours: z.number().min(0).nullable().optional(),
});

// ============ 用户验证 ============
export const userCreateSchema = z.object({
  username: z.string().min(2, '用户名至少 2 字符').max(50),
  password: z.string().min(8, '密码至少 8 位').max(128),
  displayName: z.string().min(1, '显示名不能为空').max(100),
  role: z.enum(['tenant_admin', 'space_admin', 'member']).optional(),
  department: z.string().max(100).optional(),
  email: z.string().email('邮箱格式不正确').max(200).optional(),
  active: z.boolean().optional(),
});

export const userUpdateSchema = userCreateSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).max(128).optional(),
});

// ============ 评论验证 ============
export const commentCreateSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(5000, '评论最长 5000 字符'),
  type: z.enum(['comment', 'status_change', 'assign_change']).optional(),
});

// ============ 迭代验证 ============
export const iterationCreateSchema = z.object({
  name: z.string().min(1, '迭代名称不能为空').max(100),
  projectId: z.string().uuid().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  description: z.string().max(2000).optional(),
});

export const iterationUpdateSchema = iterationCreateSchema.partial().extend({
  status: z.string().max(50).optional(),
});

// ============ 通用验证中间件 ============
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: '请求参数校验失败',
          details: errors,
        });
      }
      next(err);
    }
  };
}

// ============ SSO 租户验证 (P2-1) ============
export const tenantCreateSchema = z.object({
  code: z.string().min(1, '租户编码不能为空').max(50),
  name: z.string().min(1, '租户名称不能为空').max(200),
  shortName: z.string().max(50).optional(),
  logo: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  scale: z.string().max(50).optional(),
  contact: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  plan: z.enum(['free', 'standard', 'enterprise']).optional(),
  maxUsers: z.number().int().min(1).max(100000).optional(),
});

export const tenantUpdateSchema = tenantCreateSchema.partial().omit({ code: true });

// ============ SSO 配置验证 (P2-1) ============
export const ssoSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  appId: z.string().max(200).optional(),
  appSecret: z.string().max(500).optional(),
  redirectUri: z.string().url('redirectUri 必须是合法 URL').max(500).optional().or(z.literal('')),
  corpId: z.string().max(200).optional(),
  agentId: z.string().max(200).optional(),
  config: z.string().max(5000).optional(),
});

// ============ LLM 设置验证 (P2-1) ============
export const llmSettingsSchema = z.object({
  name: z.string().max(200).optional(),
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(1000).optional(),
  model: z.string().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(1000000).optional(),
  enabled: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  extra: z.string().max(5000).optional(),
  customModels: z.array(z.string().max(200)).optional(),
  currentModel: z.string().max(200).optional(),
});

// ============ SSO demo-login 验证 (P2-1) ============
export const ssoDemoLoginSchema = z.object({
  tenantId: z.string().min(1, 'tenantId 必填'),
  openId: z.string().min(1, 'openId 必填'),
  userName: z.string().max(100).optional(),
  email: z.string().email('邮箱格式不正确').max(200).optional().or(z.literal('')),
});

// ============ SSO 绑定/解绑验证 (P2-1) ============
export const ssoBindSchema = z.object({
  provider: z.enum(['feishu', 'dingtalk', 'wechatwork']),
  openId: z.string().min(1, 'openId 必填'),
});

// ============ 数据导出 query 验证 (P2-1) ============
// GET /api/export/work-items?format=xlsx&type=...&status=...&priority=...&assignee=...&projectCode=...&customerCode=...&keyword=...
export const exportWorkItemsSchema = z.object({
  format: z.enum(['xlsx', 'csv']).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(10).optional(),
  assignee: z.string().max(100).optional(),
  projectCode: z.string().max(50).optional(),
  customerCode: z.string().max(50).optional(),
  keyword: z.string().max(200).optional(),
});

// 通用导出 schema (projects/customers/car-models/risks)
export const exportSimpleSchema = z.object({
  format: z.enum(['xlsx', 'csv']).optional(),
});

// ============ validateQuery 中间件 (P2-1) ============
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: '查询参数校验失败',
          details: errors,
        });
      }
      next(err);
    }
  };
}
