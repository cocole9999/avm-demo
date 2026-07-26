/**
 * V1.55 可调宽度面板 hook
 *
 * 功能：
 *   - 维护面板宽度状态（持久化到 localStorage）
 *   - 提供 onMouseDown 拖拽回调
 *   - 自动限制在 [min, max] 范围内
 *   - 拖拽时禁止文本选择
 *
 * 用法：
 *   const { width, isResizing, startResize } = useResizablePanel({
 *     storageKey: 'avm-agent-panel-width',
 *     defaultWidth: 380,
 *     minWidth: 280,
 *     maxWidth: 720,
 *   });
 *
 *   <div style={{ width }}>...</div>
 *   <div onMouseDown={startResize} style={{ cursor: 'ew-resize' }} />
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizablePanelOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export function useResizablePanel(options: UseResizablePanelOptions) {
  const { storageKey, defaultWidth, minWidth, maxWidth } = options;

  // 读取 localStorage 中的持久化宽度
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultWidth;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= minWidth && n <= maxWidth) return n;
      }
    } catch { /* ignore */ }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      // 面板在右侧，鼠标左移增大、右移减小
      const delta = startXRef.current - e.clientX;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      setWidth(next);
    };
    const handleUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  // 持久化到 localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch { /* ignore */ }
  }, [width, storageKey]);

  const reset = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  return { width, isResizing, startResize, reset, setWidth };
}
