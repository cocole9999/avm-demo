// V1.50: useUndoRedo 单元测试
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUndoRedo, useUndoableState } from './useUndoRedo';

describe('useUndoRedo', () => {
  it('initializes with given value', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('update pushes previous value to undo stack', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    expect(result.current.state).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('update with function gets previous value', () => {
    const { result } = renderHook(() => useUndoRedo(10));
    act(() => result.current.update(prev => prev + 5));
    expect(result.current.state).toBe(15);
  });

  it('undo restores previous value', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    expect(result.current.state).toBe(2);
    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
  });

  it('redo restores forward value', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.state).toBe(1);
    act(() => result.current.redo());
    expect(result.current.state).toBe(2);
  });

  it('update clears redo stack', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.update(99));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toBe(99);
  });

  it('setState replaces without pushing history', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.setState(42));
    expect(result.current.state).toBe(42);
    expect(result.current.canUndo).toBe(false);
  });

  it('respects limit option', () => {
    const { result } = renderHook(() => useUndoRedo(0, { limit: 3 }));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    act(() => result.current.update(3));
    act(() => result.current.update(4));
    act(() => result.current.update(5));
    // 只能撤销 3 次
    expect(result.current.undo()).toBe(true);
    expect(result.current.undo()).toBe(true);
    expect(result.current.undo()).toBe(true);
    expect(result.current.undo()).toBe(false);
  });

  it('clear empties history without changing state', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    act(() => result.current.clear());
    expect(result.current.state).toBe(2);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('reset replaces state and clears history', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(1));
    act(() => result.current.update(2));
    act(() => result.current.reset(100));
    expect(result.current.state).toBe(100);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('reset with no arg falls back to initial', () => {
    const { result } = renderHook(() => useUndoRedo('init'));
    act(() => result.current.update('a'));
    act(() => result.current.reset());
    expect(result.current.state).toBe('init');
  });

  it('Object.is skips no-op update', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    act(() => result.current.update(0));
    expect(result.current.canUndo).toBe(false);
  });

  it('works with object state', () => {
    const { result } = renderHook(() => useUndoRedo({ count: 0, name: 'a' }));
    act(() => result.current.update(prev => ({ ...prev, count: 1 })));
    act(() => result.current.update(prev => ({ ...prev, name: 'b' })));
    expect(result.current.state).toEqual({ count: 1, name: 'b' });
    act(() => result.current.undo());
    expect(result.current.state).toEqual({ count: 1, name: 'a' });
    act(() => result.current.undo());
    expect(result.current.state).toEqual({ count: 0, name: 'a' });
  });

  it('undo returns false when stack is empty', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    expect(result.current.undo()).toBe(false);
  });

  it('redo returns false when stack is empty', () => {
    const { result } = renderHook(() => useUndoRedo(0));
    expect(result.current.redo()).toBe(false);
  });
});

describe('useUndoableState', () => {
  it('mirrors useUndoRedo API with value/commits', () => {
    const { result } = renderHook(() => useUndoableState(0));
    expect(result.current.value).toBe(0);
    act(() => result.current.commitValue(prev => prev + 1));
    expect(result.current.value).toBe(1);
    act(() => result.current.undo());
    expect(result.current.value).toBe(0);
    act(() => result.current.redo());
    expect(result.current.value).toBe(1);
  });

  it('setValue replaces without history', () => {
    const { result } = renderHook(() => useUndoableState(0));
    act(() => result.current.setValue(99));
    expect(result.current.value).toBe(99);
    expect(result.current.canUndo).toBe(false);
  });
});
