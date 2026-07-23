/**
 * 密码强度策略单元测试 (V1.30.2 P3-1d)
 */
import { describe, it, expect } from 'vitest';
import { checkPasswordStrength } from '../src/utils/passwordPolicy';

describe('checkPasswordStrength', () => {
  describe('拒绝场景', () => {
    it('拒绝空字符串', () => {
      expect(checkPasswordStrength('').ok).toBe(false);
    });

    it('拒绝过短 (< 8 位)', () => {
      expect(checkPasswordStrength('Ab1').ok).toBe(false);
      expect(checkPasswordStrength('Abc1234').ok).toBe(false); // 7 位
    });

    it('拒绝过长 (> 128 位)', () => {
      const long = 'A1' + 'a'.repeat(128);
      expect(checkPasswordStrength(long).ok).toBe(false);
    });

    it('拒绝纯字母(无数字)', () => {
      const r = checkPasswordStrength('Abcdefgh');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/数字/);
    });

    it('拒绝纯数字(无字母)', () => {
      const r = checkPasswordStrength('12345678');
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/字母/);
    });

    it('拒绝黑名单弱密码 (大小写不敏感)', () => {
      expect(checkPasswordStrength('admin123').ok).toBe(false);
      expect(checkPasswordStrength('ADMIN123').ok).toBe(false);
      expect(checkPasswordStrength('Admin123').ok).toBe(false);
      expect(checkPasswordStrength('Password1').ok).toBe(false);
      expect(checkPasswordStrength('P@ssw0rd').ok).toBe(false);
    });

    it('拒绝与 username 完全相同 (大小写不敏感, 需满足前置规则)', () => {
      // username 实际是单词 (admin/pm/zhangsan), 直接相同缺数字 → 用带数字的复合 username 测试
      const r1 = checkPasswordStrength('Admin2026', 'Admin2026');
      expect(r1.ok).toBe(false);
      expect(r1.reason).toMatch(/用户名/);
      const r2 = checkPasswordStrength('admin2026', 'Admin2026'); // 大小写不敏感
      expect(r2.ok).toBe(false);
      const r3 = checkPasswordStrength('Pm2026!', 'PM2026'); // username 含数字也拦
      expect(r3.ok).toBe(false);
    });

    it('通过: 即便首字母大写, 只要与 username 真正不同即可', () => {
      expect(checkPasswordStrength('Admin@2026', 'admin').ok).toBe(true);
      expect(checkPasswordStrength('Zhangsan2026!', 'zhangsan').ok).toBe(true);
    });
  });

  describe('通过场景', () => {
    it('通过: 大小写 + 数字 + 特殊字符 (>= 8 位)', () => {
      expect(checkPasswordStrength('Admin@2026').ok).toBe(true);
      expect(checkPasswordStrength('Pm@2026X').ok).toBe(true);
      expect(checkPasswordStrength('Hello2026!').ok).toBe(true);
    });

    it('通过: 字母 + 数字 + 特殊字符', () => {
      expect(checkPasswordStrength('Hello2026!').ok).toBe(true);
      expect(checkPasswordStrength('Test-2026-x').ok).toBe(true);
    });

    it('通过: 不与 username 冲突时', () => {
      expect(checkPasswordStrength('Hello2026!', 'zhangsan').ok).toBe(true);
    });

    it('通过: 边界长度 8 位', () => {
      expect(checkPasswordStrength('Abcd1234').ok).toBe(true); // 8 位
    });

    it('通过: 边界长度 128 位', () => {
      const pw = 'A1' + 'a'.repeat(126);
      expect(pw.length).toBe(128);
      expect(checkPasswordStrength(pw).ok).toBe(true);
    });
  });

  describe('reason 字段', () => {
    it('失败时 reason 非空', () => {
      const r = checkPasswordStrength('');
      expect(r.reason).toBeTruthy();
    });

    it('成功时 reason 不出现', () => {
      const r = checkPasswordStrength('Hello2026!');
      expect(r.reason).toBeUndefined();
    });
  });
});
