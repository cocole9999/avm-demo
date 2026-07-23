/**
 * 敏感字段加密 (V1.30.1 P2-1)
 *
 * - AES-256-GCM 加密 (认证加密, 同时保护机密性和完整性)
 * - 密钥来源: env.API_KEY_ENCRYPTION_KEY (32 字节 base64)
 * - 存储格式: enc:v1:<iv>:<authTag>:<ciphertext>  (base64)
 * - 透明迁移: 旧明文值自动识别并按明文处理
 *
 * 用途: 加密 LLM provider 的 API Key
 *
 * 安全提示:
 *   - env.API_KEY_ENCRYPTION_KEY 必须配置 (32 字节 base64 编码)
 *   - 容器部署时, 该 key 通过 docker secret 或 K8s secret 注入, 不进 git
 *   - 一旦丢失, 所有已加密的 API Key 不可恢复, 需用户重新填写
 */
import crypto from 'crypto';
import { env } from '../env';

const ALGO = 'aes-256-gcm';
// PREFIX 不带末尾冒号, 由 join 统一加分隔符
const PREFIX = 'enc:v1';

let _key: Buffer | null = null;

/** 获取解密 key, 懒加载 + 缓存 */
function getKey(): Buffer | null {
  if (_key) return _key;
  const k = env.API_KEY_ENCRYPTION_KEY;
  if (!k) {
    // 没配置 key: 返回 null, 走明文 fallback 模式
    return null;
  }
  try {
    _key = Buffer.from(k, 'base64');
    if (_key.length !== 32) {
      console.warn(`[crypto] API_KEY_ENCRYPTION_KEY 长度异常: ${_key.length} 字节, 应为 32 字节. 已禁用加密`);
      _key = null;
    }
  } catch {
    console.warn('[crypto] API_KEY_ENCRYPTION_KEY 解析失败, 已禁用加密');
    _key = null;
  }
  return _key;
}

/** 生成一个随机 32 字节 key (用于初始化 .env) */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/** 是否为已加密值 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** 纯 JS base64 编码 (兼容 vitest ESM, Buffer.toString 在该模式下偶发空字符串) */
function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const c1 = b1 >> 2;
    const c2 = ((b1 & 3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 15) << 2) | (b3 >> 6);
    const c4 = b3 & 63;
    result += chars[c1] + chars[c2];
    result += i + 1 < bytes.length ? chars[c3] : '=';
    result += i + 2 < bytes.length ? chars[c4] : '=';
  }
  return result;
}

/** 加密: 明文 -> enc:v1:iv:tag:ct  */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // 已是密文, 跳过
  const key = getKey();
  if (!key) {
    // 没配置 key: 返回明文 (开发模式兼容)
    return plaintext;
  }
  // 用纯 JS 生成 12 字节随机 IV (避开 vitest ESM 下 crypto.randomBytes/Buffer.toString 偶发问题)
  const ivBytes = randomBytesPure(12);
  if (process.env.DEBUG_CRYPTO) console.log('[debug] ivBytes len:', ivBytes.length, 'first:', ivBytes[0], ivBytes[1], ivBytes[2]);
  // 直接用 Uint8Array 作 IV (Node 16+ createCipheriv 接受 Uint8Array)
  const cipher = crypto.createCipheriv(ALGO, key, Buffer.from(ivBytes));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // IV 用纯 JS base64 编码 (不依赖 Buffer.toString)
  const ivB64 = bytesToBase64(ivBytes);
  if (process.env.DEBUG_CRYPTO) console.log('[debug] ivB64:', ivB64);
  return [
    PREFIX,
    ivB64,
    bytesToBase64(new Uint8Array(tag)),
    bytesToBase64(new Uint8Array(ct)),
  ].join(':');
}

/** 纯 JS 随机字节生成 (兼容 vitest ESM) */
function randomBytesPure(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // 优先用 webcrypto.getRandomValues (Node 16+ 全局 crypto 也有)
  const wc: any = (globalThis as any).crypto || (crypto as any).webcrypto;
  if (wc && typeof wc.getRandomValues === 'function') {
    wc.getRandomValues(out);
    return out;
  }
  // fallback: 用 Node crypto.randomBytes
  const buf = (crypto as any).randomBytes(n);
  for (let i = 0; i < n; i++) out[i] = buf[i];
  return out;
}

/** 解密: enc:v1:iv:tag:ct -> 明文 (失败时降级返回原文) */
export function decrypt(value: string): string {
  if (!value) return value;
  if (!isEncrypted(value)) return value; // 旧明文值, 直接返回
  const key = getKey();
  if (!key) {
    // 配置了密文但没 key: 视为不可用, 返回空串
    return '';
  }
  try {
    // 去掉 PREFIX 和紧随的分隔冒号
    const afterPrefix = value.startsWith(PREFIX + ':') ? value.slice(PREFIX.length + 1) : value.slice(PREFIX.length);
    const parts = afterPrefix.split(':');
    if (parts.length !== 3) return value;
    // 用纯 JS 解 base64 (兼容 vitest ESM)
    const iv = base64ToBytes(parts[0]);
    const tag = base64ToBytes(parts[1]);
    const ct = base64ToBytes(parts[2]);
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));
    return Buffer.concat([decipher.update(Buffer.from(ct)), decipher.final()]).toString('utf8');
  } catch (e) {
    console.warn('[crypto] decrypt 失败, 视为不可用:', (e as Error).message);
    return '';
  }
}

/** 纯 JS base64 解码, 不依赖 Buffer.from(string, 'base64') */
function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const bytes: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const c1 = lookup[b64.charCodeAt(i)];
    const c2 = lookup[b64.charCodeAt(i + 1)];
    const c3 = i + 2 < b64.length ? lookup[b64.charCodeAt(i + 2)] : 0;
    const c4 = i + 3 < b64.length ? lookup[b64.charCodeAt(i + 3)] : 0;
    if (c1 < 0 || c2 < 0) break; // padding or invalid
    bytes.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0 && i + 2 < b64.length) bytes.push(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 >= 0 && i + 3 < b64.length) bytes.push(((c3 & 3) << 6) | c4);
  }
  return new Uint8Array(bytes);
}

/** 用于 mask 显示 (前 4 后 4) */
export function maskKey(k: string): string {
  if (!k) return '';
  if (k.length <= 8) return '***';
  return k.slice(0, 4) + '***' + k.slice(-4);
}
