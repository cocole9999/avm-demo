// V1.53: 表单编辑撤销/重做 hook
// 用于 CrudDrawer 表单编辑场景，追踪表单字段变更并支持撤销/重做

import { useCallback, useRef, useState } from 'react';
import type { FormInstance } from 'antd';

interface FormChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface FormUndoRedoApi {
  /** 记录一次表单变更（在 onValuesChange 中调用） */
  recordChange: (changedValues: Record<string, any>, allValues: Record<string, any>) => void;
  /** 撤销最近一次变更 */
  undo: () => boolean;
  /** 重做最近撤销的变更 */
  redo: () => boolean;
  /** 是否能撤销 */
  canUndo: boolean;
  /** 是否能重做 */
  canRedo: boolean;
  /** 清空历史 */
  clear: () => void;
  /** 初始化基线值（编辑时调用，设置表单初始值后调用） */
  init: (values: Record<string, any>) => void;
}

export function useFormUndoRedo(form: FormInstance<any>, limit = 50): FormUndoRedoApi {
  const undoStackRef = useRef<FormChange[]>([]);
  const redoStackRef = useRef<FormChange[]>([]);
  const [tick, setTick] = useState(0);
  // 保存上一次的 allValues 用于 diff
  const prevValuesRef = useRef<Record<string, any>>({});

  const recordChange = useCallback(
    (changedValues: Record<string, any>, _allValues: Record<string, any>) => {
      const prev = prevValuesRef.current;
      const changes: FormChange[] = [];

      for (const field of Object.keys(changedValues)) {
        const oldValue = prev[field];
        const newValue = changedValues[field];
        // 跳过初始化和相同值
        if (oldValue === undefined || oldValue === newValue) continue;
        changes.push({ field, oldValue, newValue });
      }

      // 更新 prevValues（合并所有字段）
      prevValuesRef.current = { ...prevValuesRef.current, ...changedValues };

      if (changes.length === 0) return;

      // 多个字段同时变更（如 AI 填充）合并为一个 undo 条目
      if (changes.length === 1) {
        pushUndo(changes[0]);
      } else {
        // 批量变更：逐个 push，但 undo 时一次回退所有
        // 简化处理：合并为一个条目，用特殊标记
        pushUndo({
          field: '__batch__',
          oldValue: changes.map(c => ({ field: c.field, value: c.oldValue })),
          newValue: changes.map(c => ({ field: c.field, value: c.newValue })),
        });
      }
    },
    [],
  );

  const pushUndo = (change: FormChange) => {
    undoStackRef.current.push(change);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setTick(t => t + 1);
  };

  const undo = useCallback((): boolean => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;

    const change = stack.pop()!;
    redoStackRef.current.push(change);
    if (redoStackRef.current.length > limit) {
      redoStackRef.current.shift();
    }

    // 还原表单值
    if (change.field === '__batch__') {
      const batch = change.oldValue as Array<{ field: string; value: any }>;
      const fields: Record<string, any> = {};
      batch.forEach(({ field, value }) => { fields[field] = value; });
      form.setFieldsValue(fields);
      // 更新 prevValues
      prevValuesRef.current = { ...prevValuesRef.current, ...fields };
    } else {
      form.setFieldValue(change.field, change.oldValue);
      prevValuesRef.current[change.field] = change.oldValue;
    }

    setTick(t => t + 1);
    return true;
  }, [form, limit]);

  const redo = useCallback((): boolean => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return false;

    const change = stack.pop()!;
    undoStackRef.current.push(change);
    if (undoStackRef.current.length > limit) {
      undoStackRef.current.shift();
    }

    if (change.field === '__batch__') {
      const batch = change.newValue as Array<{ field: string; value: any }>;
      const fields: Record<string, any> = {};
      batch.forEach(({ field, value }) => { fields[field] = value; });
      form.setFieldsValue(fields);
      prevValuesRef.current = { ...prevValuesRef.current, ...fields };
    } else {
      form.setFieldValue(change.field, change.newValue);
      prevValuesRef.current[change.field] = change.newValue;
    }

    setTick(t => t + 1);
    return true;
  }, [form, limit]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    prevValuesRef.current = {};
    setTick(t => t + 1);
  }, []);

  const init = useCallback((values: Record<string, any>) => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    prevValuesRef.current = { ...values };
    setTick(t => t + 1);
  }, []);

  return {
    recordChange,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clear,
    init,
  };
}