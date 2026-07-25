/**
 * V1.48 useDebouncedValue - 搜索防抖 Hook
 *
 * 用法：
 *   const [q, setQ] = useState('');
 *   const debouncedQ = useDebouncedValue(q, 300);
 *   useEffect(() => { load(debouncedQ); }, [debouncedQ]);
 *
 * 或直接传一个值，防抖后再用：
 *   const debouncedKeyword = useDebouncedValue(keyword, 300);
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
