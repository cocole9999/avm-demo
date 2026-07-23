/**
 * 密码哈希工具 (V1.30)
 *
 * - 新密码统一用 bcrypt (cost factor 来自 env.BCRYPT_ROUNDS, 默认 10)
 * - 登录时兼容旧 SHA256 哈希, 验证通过后自动升级到 bcrypt
 * - 静态盐 (avm-salt) 保留以兼容历史数据, 仅用作 fallback 校验
 *
 * 选型说明:
 *   - bcryptjs (纯 JS 跨平台) 而非 bcrypt (需 node-gyp 编译, Windows 容易失败)
 *   - cost=10 单次约 100ms, 兼顾安全与登录体验
 *   - 字段长度: bcrypt 60 字符, SHA256 64 字符, User.password 字段 (String) 兼容
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../env';

const LEGACY_SALT = 'avm-salt';
const BCRYPT_PREFIX = '$2'; // bcrypt 哈希以 $2a$ / $2b$ / $2y$ 开头

/** 判断是否为 bcrypt 哈希 */
export function isBcryptHash(hash: string): boolean {
  return hash.startsWith(BCRYPT_PREFIX);
}

/** 判断是否为旧 SHA256 哈希 (64 位 hex) */
export function isLegacySha256(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

/** 旧 SHA256 计算 (仅用于兼容校验) */
function legacySha256(pwd: string): string {
  return crypto.createHash('sha256').update(pwd + LEGACY_SALT).digest('hex');
}

/** 异步生成密码哈希 (新用户/改密) */
export async function hashPassword(pwd: string): Promise<string> {
  if (!pwd || pwd.length < 6) {
    throw new Error('密码至少 6 位');
  }
  return bcrypt.hash(pwd, env.BCRYPT_ROUNDS);
}

/** 异步校验密码, 返回 { ok, needUpgrade } */
export async function verifyPassword(pwd: string, storedHash: string): Promise<{ ok: boolean; needUpgrade: boolean }> {
  if (!storedHash) return { ok: false, needUpgrade: false };

  // 新版 bcrypt
  if (isBcryptHash(storedHash)) {
    const ok = await bcrypt.compare(pwd, storedHash);
    return { ok, needUpgrade: false };
  }

  // 旧版 SHA256 (兼容)
  if (isLegacySha256(storedHash)) {
    const ok = legacySha256(pwd) === storedHash;
    return { ok, needUpgrade: ok }; // 验证成功则提示调用方升级
  }

  // 未知格式: 拒绝
  return { ok: false, needUpgrade: false };
}
