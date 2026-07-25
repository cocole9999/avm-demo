/**
 * 通用导出 Hook (V1.46.2)
 *
 * 封装 xlsx/csv 导出的 loading 状态、文件名解析、blob 下载。
 *
 * @example
 *   const { exporting, handleExport } = useExport(
 *     (format) => aiApi.exportCustomers({ format }),
 *     'customers',
 *   );
 */
import { useCallback, useState } from 'react';
import { downloadBlob, getFilenameFromResponse } from '../utils/download';
import { notifyApiError } from '../utils/apiError';

export type ExportFormat = 'xlsx' | 'csv';

export interface UseExportOptions {
  /** 失败时的提示文案前缀（默认 `导出失败`） */
  errorPrefix?: string;
}

export interface UseExportResult {
  exporting: boolean;
  handleExport: (format: ExportFormat) => Promise<void>;
}

export function useExport(
  exportFn: (format: ExportFormat) => Promise<Blob & { headers?: any }>,
  filenamePrefix: string,
  options: UseExportOptions = {},
): UseExportResult {
  const { errorPrefix = '导出失败' } = options;
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExporting(true);
    try {
      const blob = await exportFn(format);
      const defaultName = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.${format}`;
      const filename = getFilenameFromResponse((blob as any)?.headers, defaultName);
      downloadBlob(blob as Blob, filename);
    } catch (e) {
      notifyApiError(e, `${errorPrefix}：`);
    } finally {
      setExporting(false);
    }
  }, [exportFn, filenamePrefix, errorPrefix]);

  return { exporting, handleExport };
}
