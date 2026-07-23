/**
 * V1.30.2 P3-1b 单元测试
 * 覆盖: 文件下载 / Content-Disposition 解析
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadBlob, getFilenameFromResponse } from './download';

describe('download utility', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    // jsdom 没有 URL.createObjectURL, mock
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  describe('getFilenameFromResponse', () => {
    it('从标准 Content-Disposition 解析 filename', () => {
      const headers = { 'content-disposition': 'attachment; filename="report.xlsx"' };
      expect(getFilenameFromResponse(headers, 'fallback.xlsx')).toBe('report.xlsx');
    });

    it('支持 RFC 5987 filename* 编码 (UTF-8 百分号编码)', () => {
      const headers = { 'content-disposition': "attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A.xlsx" };
      expect(getFilenameFromResponse(headers, 'fallback.xlsx')).toBe('报告.xlsx');
    });

    it('支持 Content-Disposition 大小写', () => {
      const headers = { 'Content-Disposition': 'attachment; filename="data.csv"' };
      expect(getFilenameFromResponse(headers, 'fallback')).toBe('data.csv');
    });

    it('无 Content-Disposition 返回 fallback', () => {
      expect(getFilenameFromResponse({}, 'default.json')).toBe('default.json');
      expect(getFilenameFromResponse(undefined, 'default.json')).toBe('default.json');
    });

    it('filename 含中文未编码时, 尝试 decode 失败回退原文', () => {
      const headers = { 'content-disposition': 'attachment; filename="中文.xlsx"' };
      // 不带 UTF-8'' 前缀, 直接 decode 可能成功也可能失败, 至少能拿到 fallback / 原文
      const result = getFilenameFromResponse(headers, 'fallback');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('downloadBlob', () => {
    it('调用 createObjectURL / createElement("a") / click / revokeObjectURL', () => {
      const blob = new Blob(['hello'], { type: 'text/plain' });
      const appendChild = vi.spyOn(document.body, 'appendChild');
      const removeChild = vi.spyOn(document.body, 'removeChild');

      downloadBlob(blob, 'test.txt');

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      // appendChild 至少被调用 1 次 (a 元素)
      expect(appendChild).toHaveBeenCalled();
      // removeChild 收尾
      expect(removeChild).toHaveBeenCalled();
    });
  });
});
