/**
 * V1.30.3 P2-5 单元测试
 * 覆盖: API 拦截器 / 认证处理 / 401 跳转
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from './api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('api interceptors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request interceptor', () => {
    it('自动注入 token 到 Authorization header', async () => {
      const mockToken = 'test-token-123';
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({
        user: { id: '1', username: 'test', displayName: 'Test', role: 'member' },
        token: mockToken,
      }));

      const config = { headers: {} as any };
      const result = await api.interceptors.request.handlers![0].fulfilled?.(config);

      expect(result?.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('无 token 时不注入 Authorization', async () => {
      localStorageMock.getItem.mockReturnValueOnce(null as unknown as string);

      const config = { headers: {} as any };
      const result = await api.interceptors.request.handlers![0].fulfilled?.(config);

      expect(result?.headers.Authorization).toBeUndefined();
    });

    it('localStorage 解析失败时不抛错', async () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-json{');

      const config = { headers: {} as any };
      const result = await api.interceptors.request.handlers![0].fulfilled?.(config);

      expect(result?.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor', () => {
    it('401 错误清除 localStorage 并跳转登录页', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, pathname: '/dashboard', href: '' },
      });

      const error = { response: { status: 401 } };
      
      try {
        await api.interceptors.response.handlers![0].rejected?.(error);
      } catch {
        // Expected to reject
      }

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('avm-auth');
      expect(window.location.href).toBe('/login?expired=1');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('在登录页时不重复跳转', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, pathname: '/login', href: '' },
      });

      const error = { response: { status: 401 } };
      
      try {
        await api.interceptors.response.handlers![0].rejected?.(error);
      } catch {
        // Expected
      }

      expect(window.location.href).toBe('');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });

    it('非 401 错误直接 reject', async () => {
      const error = { response: { status: 500 }, message: 'Server error' };
      
      await expect(
        api.interceptors.response.handlers![0].rejected?.(error)
      ).rejects.toEqual(error);
    });
  });
});
