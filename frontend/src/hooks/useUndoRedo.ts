// V1.50: 撤销/重做 hook
// 提供基础 useUndoRedo（命令式）和便捷的 useUndoableState（替代 useState）

import { useCallback, useRef, useState } from 'react';

export interface UndoRedoApi<T> {
  /** 当前状态 */
  state: T;
  /** 替换状态（不影响历史栈） */
  setState: (next: T) => void;
  /** 记录状态变化（自动 push 到 undo 栈） */
  update: (next: T | ((prev: T) => T)) => void;
  /** 撤销到上一步，返回是否成功 */
  undo: () => boolean;
  /** 重做最近撤销的步骤，返回是否成功 */
  redo: () => boolean;
  /** 是否能撤销 */
  canUndo: boolean;
  /** 是否能重做 */
  canRedo: boolean;
  /** 清空历史栈（不修改当前 state） */
  clear: () => void;
  /** 重置 state 并清空历史 */
  reset: (next?: T) => void;
}

export interface UseUndoRedoOptions {
  /** 最大历史栈深度（默认 50） */
  limit?: number;
}

const DEFAULT_LIMIT = 50;

/**
 * 命令式 useUndoRedo
 *
 * 用法：
 *   const { state, update, undo, redo, canUndo, canRedo } = useUndoRedo<MyState>(0, { limit: 30 });
 *   update(prev => prev + 1);
 *   if (canUndo) undo();
 */
export function useUndoRedo<T>(initial: T, options: UseUndoRedoOptions = {}): UndoRedoApi<T> {
  const limit = options.limit ?? DEFAULT_LIMIT;

  const [state, setStateInternal] = useState<T>(initial);
  // 用 ref 避免在 update 中拿到旧 state
  const stateRef = useRef<T>(initial);
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  // 触发 canUndo/canRedo 重渲染
  const [historyTick, setHistoryTick] = useState(0);

  const setState = useCallback((next: T) => {
    stateRef.current = next;
    setStateInternal(next);
  }, []);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    const prev = stateRef.current;
    const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
    if (Object.is(value, prev)) return;
    undoStackRef.current.push(prev);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    stateRef.current = value;
    setStateInternal(value);
    setHistoryTick(t => t + 1);
  }, [limit]);

  const undo = useCallback((): boolean => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;
    const prev = stack.pop()!;
    redoStackRef.current.push(stateRef.current);
    if (redoStackRef.current.length > limit) {
      redoStackRef.current.shift();
    }
    stateRef.current = prev;
    setStateInternal(prev);
    setHistoryTick(t => t + 1);
    return true;
  }, [limit]);

  const redo = useCallback((): boolean => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return false;
    const next = stack.pop()!;
    undoStackRef.current.push(stateRef.current);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }
    stateRef.current = next;
    setStateInternal(next);
    setHistoryTick(t => t + 1);
    return true;
  }, [limit]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryTick(t => t + 1);
  }, []);

  const reset = useCallback((next?: T) => {
    const value = next !== undefined ? next : initial;
    stateRef.current = value;
    setStateInternal(value);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryTick(t => t + 1);
  }, [initial]);

  return {
    state,
    setState,
    update,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clear,
    reset,
  };
}

/**
 * 便捷 hook：可撤销的 useState 替代
 *  - `setValue(value)` 替换而不记录历史
 *  - `commitValue(value | fn)` 记录到 undo 栈
 *
 * 用法：
 *   const { value, setValue, commitValue, undo, redo } = useUndoableState(0);
 *   commitValue(prev => prev + 1);
 */
export function useUndoableState<T>(initial: T, options?: UseUndoRedoOptions): {
  value: T;
  setValue: (next: T) => void;
  commitValue: (next: T | ((prev: T) => T)) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  reset: (next?: T) => void;
} {
  const api = useUndoRedo<T>(initial, options);
  return {
    value: api.state,
    setValue: api.setState,
    commitValue: api.update,
    undo: api.undo,
    redo: api.redo,
    canUndo: api.canUndo,
    canRedo: api.canRedo,
    clear: api.clear,
    reset: api.reset,
  };
}
