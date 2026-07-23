/**
 * 集中读环境变量（统一默认值，方便测试时覆盖）
 */
function get(name: string, def = ''): string {
  return process.env[name] ?? def;
}

function getInt(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export const env = {
  // LLM
  LLM_PROVIDER: get('LLM_PROVIDER', 'mock'), // openai | anthropic | mock
  LLM_API_KEY: get('LLM_API_KEY', ''),
  LLM_BASE_URL: get('LLM_BASE_URL', ''),
  LLM_MODEL: get('LLM_MODEL', ''),
  // 飞书 OAuth（企业版）
  FEISHU_APP_ID: get('FEISHU_APP_ID', ''),
  FEISHU_APP_SECRET: get('FEISHU_APP_SECRET', ''),
  FEISHU_REDIRECT_URI: get('FEISHU_REDIRECT_URI', 'http://localhost:5173/sso/feishu/callback'),
  // 数据库（Prisma 内部用 DATABASE_URL，这里只是常量占位）
  DATABASE_URL: get('DATABASE_URL', 'file:./prisma/dev.db'),
  // 服务端口
  PORT: Number(get('PORT', '4000')),
  // V1.30 安全配置
  BCRYPT_ROUNDS: getInt('BCRYPT_ROUNDS', 10),
  TOKEN_TTL_HOURS: getInt('TOKEN_TTL_HOURS', 168),  // 默认 7 天
  RATE_LIMIT_WINDOW_MS: getInt('RATE_LIMIT_WINDOW_MS', 60000),  // 1 分钟
  RATE_LIMIT_MAX: getInt('RATE_LIMIT_MAX', 300),
  LOG_LEVEL: get('LOG_LEVEL', 'info'),
  // V1.30.1 P2-1: 敏感字段加密 (32 字节 base64, 不配置则用明文兼容旧数据)
  // 生成: tsx -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  API_KEY_ENCRYPTION_KEY: get('API_KEY_ENCRYPTION_KEY', ''),
  // V1.30.3 P2-8: Sentry 错误追踪（不配置 DSN 则禁用）
  SENTRY_DSN: get('SENTRY_DSN', ''),
  SENTRY_ENABLED: get('SENTRY_ENABLED', 'true'),
  SENTRY_ENVIRONMENT: get('SENTRY_ENVIRONMENT', ''),
  SENTRY_TRACES_SAMPLE_RATE: get('SENTRY_TRACES_SAMPLE_RATE', '0.05'),
  // V1.30.3 P0: CORS 白名单（生产必须配置）
  CORS_ORIGIN: get('CORS_ORIGIN', ''),
};

const FORBIDDEN_DEFAULT_PASSWORDS = new Set([
  'Admin@2026', 'Pm2026!!', 'User@2026',
]);

/**
 * 生产环境启动前强制校验。
 * 发现阻塞性配置错误时直接抛出，避免带着隐患运行。
 */
export function validateProductionEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return;

  const errors: string[] = [];

  // 1. CORS 白名单
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN.trim() === '') {
    errors.push('生产环境必须配置 CORS_ORIGIN（逗号分隔的允许域名）');
  }

  // 2. API Key 加密密钥
  if (!env.API_KEY_ENCRYPTION_KEY) {
    errors.push('生产环境必须配置 API_KEY_ENCRYPTION_KEY（32 字节 base64）');
  } else {
    try {
      const buf = Buffer.from(env.API_KEY_ENCRYPTION_KEY, 'base64');
      if (buf.length !== 32) {
        errors.push(`API_KEY_ENCRYPTION_KEY 解码后必须为 32 字节，当前 ${buf.length} 字节`);
      }
    } catch {
      errors.push('API_KEY_ENCRYPTION_KEY 不是有效的 base64 字符串');
    }
  }

  if (errors.length > 0) {
    throw new Error(`[production-env] 启动被阻止:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

/** 校验 seed 密码不能是演示默认值（生产环境） */
export function validateSeedPassword(name: string, password: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return;

  if (FORBIDDEN_DEFAULT_PASSWORDS.has(password)) {
    throw new Error(`[production-env] 生产环境禁止使用默认演示密码 ${name}=${password}，请设置 SEED_${name.toUpperCase()}_PASSWORD`);
  }
}
