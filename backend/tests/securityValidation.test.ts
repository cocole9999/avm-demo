/**
 * P2-3 单元测试: 安全相关 Zod schema 校验
 * 覆盖 P2-1: sso/llmSettings/export 路由的输入校验逻辑
 *
 * 不依赖后端运行, 纯函数级测试
 */
import { describe, it, expect } from 'vitest';
import {
  tenantCreateSchema,
  tenantUpdateSchema,
  ssoSettingsSchema,
  ssoDemoLoginSchema,
  ssoBindSchema,
  llmSettingsSchema,
  exportWorkItemsSchema,
  exportSimpleSchema,
} from '../src/utils/validation';

describe('P2-1: SSO 租户校验 (tenantCreateSchema)', () => {
  it('合法租户数据通过', () => {
    const r = tenantCreateSchema.parse({
      code: 'TENANT001',
      name: '测试租户',
      plan: 'standard',
      maxUsers: 100,
    });
    expect(r.code).toBe('TENANT001');
    expect(r.plan).toBe('standard');
  });

  it('code 为空被拒绝', () => {
    const r = tenantCreateSchema.safeParse({ code: '', name: 'x' });
    expect(r.success).toBe(false);
  });

  it('plan 非法值被拒绝', () => {
    const r = tenantCreateSchema.safeParse({ code: 'T1', name: 'x', plan: 'invalid_plan' });
    expect(r.success).toBe(false);
  });

  it('maxUsers 超上限被拒绝', () => {
    const r = tenantCreateSchema.safeParse({ code: 'T1', name: 'x', maxUsers: 999999 });
    expect(r.success).toBe(false);
  });

  it('maxUsers 非整数被拒绝', () => {
    const r = tenantCreateSchema.safeParse({ code: 'T1', name: 'x', maxUsers: 1.5 });
    expect(r.success).toBe(false);
  });
});

describe('P2-1: SSO 租户更新校验 (tenantUpdateSchema)', () => {
  it('不允许修改 code (omit 生效)', () => {
    // tenantUpdateSchema omit 了 code, 传 code 应被忽略或拒绝
    const r = tenantUpdateSchema.safeParse({ code: 'HACKED', name: '新名' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty('code');
    }
  });

  it('合法更新通过', () => {
    const r = tenantUpdateSchema.safeParse({ name: '新名称', contact: '张三' });
    expect(r.success).toBe(true);
  });
});

describe('P2-1: SSO 配置校验 (ssoSettingsSchema)', () => {
  it('合法配置通过', () => {
    const r = ssoSettingsSchema.parse({
      enabled: true,
      appId: 'cli_xxx',
      appSecret: 'secret_xxx',
      redirectUri: 'https://example.com/callback',
    });
    expect(r.enabled).toBe(true);
  });

  it('redirectUri 非法 URL 被拒绝', () => {
    const r = ssoSettingsSchema.safeParse({ redirectUri: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('redirectUri 空字符串允许 (兼容清空场景)', () => {
    const r = ssoSettingsSchema.safeParse({ redirectUri: '' });
    expect(r.success).toBe(true);
  });

  it('enabled 非布尔值被拒绝', () => {
    const r = ssoSettingsSchema.safeParse({ enabled: 'yes' });
    expect(r.success).toBe(false);
  });
});

describe('P2-1: SSO demo-login 校验 (ssoDemoLoginSchema)', () => {
  it('缺少 tenantId 被拒绝', () => {
    const r = ssoDemoLoginSchema.safeParse({ openId: 'o1' });
    expect(r.success).toBe(false);
  });

  it('缺少 openId 被拒绝', () => {
    const r = ssoDemoLoginSchema.safeParse({ tenantId: 't1' });
    expect(r.success).toBe(false);
  });

  it('合法数据通过', () => {
    const r = ssoDemoLoginSchema.parse({ tenantId: 't1', openId: 'o1', userName: '张三' });
    expect(r.tenantId).toBe('t1');
  });

  it('email 格式错误被拒绝', () => {
    const r = ssoDemoLoginSchema.safeParse({ tenantId: 't1', openId: 'o1', email: 'bad-email' });
    expect(r.success).toBe(false);
  });
});

describe('P2-1: SSO 绑定校验 (ssoBindSchema)', () => {
  it('provider 非法值被拒绝', () => {
    const r = ssoBindSchema.safeParse({ provider: 'github', openId: 'o1' });
    expect(r.success).toBe(false);
  });

  it('合法 feishu 绑定通过', () => {
    const r = ssoBindSchema.parse({ provider: 'feishu', openId: 'o1' });
    expect(r.provider).toBe('feishu');
  });

  it('缺少 openId 被拒绝', () => {
    const r = ssoBindSchema.safeParse({ provider: 'feishu' });
    expect(r.success).toBe(false);
  });
});

describe('P2-1: LLM 设置校验 (llmSettingsSchema)', () => {
  it('合法配置通过', () => {
    const r = llmSettingsSchema.parse({
      name: 'DeepSeek',
      apiKey: 'sk-xxx',
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
      isPrimary: true,
    });
    expect(r.temperature).toBe(0.7);
  });

  it('temperature 超范围 [0, 2] 被拒绝', () => {
    expect(llmSettingsSchema.safeParse({ temperature: 3 }).success).toBe(false);
    expect(llmSettingsSchema.safeParse({ temperature: -1 }).success).toBe(false);
  });

  it('maxTokens 非正整数被拒绝', () => {
    expect(llmSettingsSchema.safeParse({ maxTokens: 0 }).success).toBe(false);
    expect(llmSettingsSchema.safeParse({ maxTokens: 1.5 }).success).toBe(false);
  });

  it('maxTokens 超上限被拒绝', () => {
    expect(llmSettingsSchema.safeParse({ maxTokens: 2000000 }).success).toBe(false);
  });

  it('enabled 非布尔值被拒绝', () => {
    expect(llmSettingsSchema.safeParse({ enabled: 1 }).success).toBe(false);
  });

  it('customModels 非数组被拒绝', () => {
    expect(llmSettingsSchema.safeParse({ customModels: 'not-array' }).success).toBe(false);
  });
});

describe('P2-1: 数据导出 query 校验 (exportWorkItemsSchema)', () => {
  it('合法 query 通过', () => {
    const r = exportWorkItemsSchema.parse({
      format: 'xlsx',
      type: 'task',
      status: '进行中',
      priority: 'P1',
      assignee: 'zhangsan',
      keyword: '搜索词',
    });
    expect(r.format).toBe('xlsx');
  });

  it('format 非法值被拒绝', () => {
    expect(exportWorkItemsSchema.safeParse({ format: 'pdf' }).success).toBe(false);
  });

  it('keyword 过长被拒绝', () => {
    expect(exportWorkItemsSchema.safeParse({ keyword: 'x'.repeat(201) }).success).toBe(false);
  });

  it('空 query 通过 (全量导出)', () => {
    expect(exportWorkItemsSchema.safeParse({}).success).toBe(true);
  });
});

describe('P2-1: 简单导出 query 校验 (exportSimpleSchema)', () => {
  it('format=csv 通过', () => {
    expect(exportSimpleSchema.safeParse({ format: 'csv' }).success).toBe(true);
  });

  it('format=xlsx 通过', () => {
    expect(exportSimpleSchema.safeParse({ format: 'xlsx' }).success).toBe(true);
  });

  it('format 非法值被拒绝', () => {
    expect(exportSimpleSchema.safeParse({ format: 'json' }).success).toBe(false);
  });

  it('空 query 通过', () => {
    expect(exportSimpleSchema.safeParse({}).success).toBe(true);
  });
});
