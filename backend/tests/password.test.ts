/**
 * P2-3 单元测试: 密码哈希工具
 * 覆盖: hashPassword / verifyPassword / 旧 SHA256 兼容升级路径
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword, isBcryptHash, isLegacySha256 } from '../src/utils/password';
import { env } from '../src/env';

describe('password utility', () => {
  it('hashPassword 生成 bcrypt 格式哈希', async () => {
    const h = await hashPassword('hello123');
    expect(isBcryptHash(h)).toBe(true);
    expect(h).toMatch(/^\$2[aby]\$10\$/);
  });

  it('hashPassword 拒绝 < 6 位密码', async () => {
    await expect(hashPassword('123')).rejects.toThrow();
  });

  it('verifyPassword 正确密码返回 ok=true', async () => {
    const h = await hashPassword('correct-horse');
    const r = await verifyPassword('correct-horse', h);
    expect(r.ok).toBe(true);
    expect(r.needUpgrade).toBe(false);
  });

  it('verifyPassword 错误密码返回 ok=false', async () => {
    const h = await hashPassword('correct-horse');
    const r = await verifyPassword('wrong-pwd', h);
    expect(r.ok).toBe(false);
    expect(r.needUpgrade).toBe(false);
  });

  it('verifyPassword 兼容旧 SHA256 哈希, 需升级', async () => {
    // 模拟旧数据: SHA256(pwd + 'avm-salt')
    const crypto = await import('crypto');
    const legacy = crypto.createHash('sha256').update('legacy-123' + 'avm-salt').digest('hex');
    expect(isLegacySha256(legacy)).toBe(true);
    const r = await verifyPassword('legacy-123', legacy);
    expect(r.ok).toBe(true);
    expect(r.needUpgrade).toBe(true);  // 提示调用方升级
  });

  it('verifyPassword 拒绝未知格式', async () => {
    const r = await verifyPassword('any', 'not-a-hash');
    expect(r.ok).toBe(false);
  });
});
