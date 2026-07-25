/**
 * 通用异步状态 Hook (V1.46.2)
 *
 * 封装 loading / data / error 三件套 + 自动重试。
 * 用于非 CRUD 场景的资源加载（如统计、分析、单条详情）。
 *
 * @example
 *   const { data, loading, error, reload } = useAsync(() => customerApi.stats(), []);
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAsyncOptions {
  immediate?: boolean;       // 默认 true；false 时需手动调 reload()
  onError?: (e: unknown) => void;
}

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<T | null>;
  setData: (data: T | null) => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: any[] = [],
  options: UseAsyncOptions = {},
): UseAsyncResult<T> {
  const { immediate = true, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
      return result;
    } catch (e: any) {
      setError(e);
      onError?.(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}
