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
};
