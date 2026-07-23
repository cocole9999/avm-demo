/**
 * P2-3 单元测试: 敏感字段加密 (AES-256-GCM)
 * 覆盖: encrypt/decrypt 对称 / 密文格式 / 无 key 兼容明文
 */
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { env } from '../src/env';
import * as cryptoUtil from '../src/utils/crypto';

const TEST_KEY = crypto.randomBytes(32).toString('base64');

beforeAll(() => {
  // 直接给 env 对象赋值 (不重置模块, env 在 import 时就读取)
  (env as any).API_KEY_ENCRYPTION_KEY = TEST_KEY;
  // 重置 crypto 模块的内部 _key 缓存
  (cryptoUtil as any)._key = null;
});

describe('crypto utility (AES-256-GCM)', () => {
  it('encrypt 生成 enc:v1 密文格式', () => {
    const ct = cryptoUtil.encrypt('sk-test-1234567890');
    expect(cryptoUtil.isEncrypted(ct)).toBe(true);
    expect(ct).toMatch(/^enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  });

  it('encrypt → decrypt 还原', () => {
    const plain = 'sk-very-long-test-key-with-special-chars-!@#$%^&*()';
    const ct = cryptoUtil.encrypt(plain);
    expect(ct).not.toBe(plain);
    expect(cryptoUtil.decrypt(ct)).toBe(plain);
  });

  it('encrypt 两次同一明文, 密文不同 (IV 随机)', () => {
    const ct1 = cryptoUtil.encrypt('same-plain');
    const ct2 = cryptoUtil.encrypt('same-plain');
    expect(ct1).not.toBe(ct2);
  });

  it('encrypt 已是密文则跳过', () => {
    const ct = cryptoUtil.encrypt('plain');
    const ct2 = cryptoUtil.encrypt(ct);
    expect(ct2).toBe(ct);
  });

  it('decrypt 旧明文直接返回 (向后兼容)', () => {
    const plain = 'unencrypted-legacy-key';
    expect(cryptoUtil.decrypt(plain)).toBe(plain);
  });

  it('decrypt 失败返回空串', () => {
    expect(cryptoUtil.decrypt('enc:v1:invalid:invalid:invalid')).toBe('');
  });

  it('maskKey 前 4 后 4', () => {
    expect(cryptoUtil.maskKey('sk-1234567890abcdef')).toBe('sk-1***cdef');
    expect(cryptoUtil.maskKey('short')).toBe('***');
    expect(cryptoUtil.maskKey('')).toBe('');
  });

  it('generateEncryptionKey 返回 32 字节 base64', () => {
    const k = cryptoUtil.generateEncryptionKey();
    const buf = Buffer.from(k, 'base64');
    expect(buf.length).toBe(32);
  });
});
