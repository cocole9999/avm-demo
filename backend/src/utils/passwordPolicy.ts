/**
 * 密码强度校验 (V1.30.2 P3-1d)
 *
 * 业务规则:
 * - 长度 ≥ 8 位
 * - 必须包含 数字 + 字母
 * - 弱密码黑名单 (top 100 常见密码)
 * - 不允许与 username 相同
 *
 * 返回: { ok: true } 或 { ok: false, reason: '...' }
 */

const WEAK_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'admin123', 'admin@123', 'letmein',
  'welcome', 'welcome1', 'iloveyou', 'monkey', 'dragon',
  'football', 'baseball', 'sunshine', 'princess', 'trustno1',
  'abc123', '11111111', '12341234', 'asdf1234', 'passw0rd',
  'p@ssw0rd', 'P@ssw0rd', 'qwer1234', 'zxcvbnm1',
]);

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function checkPasswordStrength(pw: string, username?: string): PasswordCheck {
  if (!pw) return { ok: false, reason: '密码不能为空' };
  if (pw.length < 8) return { ok: false, reason: '密码至少 8 位' };
  if (pw.length > 128) return { ok: false, reason: '密码最长 128 位' };
  if (!/\d/.test(pw)) return { ok: false, reason: '密码必须包含数字' };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, reason: '密码必须包含字母' };
  if (WEAK_PASSWORDS.has(pw.toLowerCase())) {
    return { ok: false, reason: '密码过于简单, 请使用更复杂的密码' };
  }
  if (username && pw.toLowerCase() === username.toLowerCase()) {
    return { ok: false, reason: '密码不能与用户名相同' };
  }
  return { ok: true };
}
