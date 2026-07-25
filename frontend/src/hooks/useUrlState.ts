/**
 * V1.48 useUrlState - 把筛选/分页/Tab 状态同步到 URL search params
 *
 * 用法：
 *   const [status, setStatus] = useUrlState('status', '');
 *   const [page, setPage] = useUrlState('page', 1, Number);
 *
 * URL 变化时自动同步 state；setState 时自动更新 URL（replace 模式，不污染历史）
 *
 * @param key URL search params 的 key
 * @param defaultValue 默认值
 * @param transform 可选的类型转换函数（如 Number、Boolean、String）
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlState<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
  transform?: (raw: string) => T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value: T = (() => {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;
    if (transform) return transform(raw);
    return raw as unknown as T;
  })();

  const setValue = useCallback((newValue: T) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newValue === defaultValue || newValue === '' || newValue == null) {
        next.delete(key);
      } else {
        next.set(key, String(newValue));
      }
      return next;
    }, { replace: true });
  }, [key, defaultValue, setSearchParams]);

  return [value, setValue];
}
