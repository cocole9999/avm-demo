// V1.53: 操作撤销/重做 hook
// 用于追踪异步操作（如看板拖拽状态变更）并支持撤销/重做
// 与 useUndoRedo 不同，这里追踪的是操作栈而非状态快照

import { useCallback, useRef, useState } from 'react';

export interface OperationUndoApi<T> {
  /** 记录一个操作（可撤销） */
  push: (op: T) => void;
  /** 撤销最近操作，返回操作对象供调用方执行回退 */
  undo: () => T | null;
  /** 重做最近撤销的操作，返回操作对象供调用方重新执行 */
  redo: () => T | null;
  /** 是否能撤销 */
  canUndo: boolean;
  /** 是否能重做 */
  canRedo: boolean;
  /** 清空操作栈 */
  clear: () => void;
}

export function useOperationUndo<T>(limit = 30): OperationUndoApi<T> {
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  const [tick, setTick] = useState(0);

  const push = useCallback((op: T) => {
    undoStackRef.current.push(op);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setTick(t => t + 1);
  }, [limit]);

  const undo = useCallback((): T | null => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return null;
    const op = stack.pop()!;
    redoStackRef.current.push(op);
    if (redoStackRef.current.length > limit) {
      redoStackRef.current.shift();
    }
    setTick(t => t + 1);
    return op;
  }, [limit]);

  const redo = useCallback((): T | null => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return null;
    const op = stack.pop()!;
    undoStackRef.current.push(op);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }
    setTick(t => t + 1);
    return op;
  }, [limit]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setTick(t => t + 1);
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clear,
  };
}