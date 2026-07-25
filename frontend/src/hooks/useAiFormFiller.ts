/**
 * AI 表单填充 Hook (V1.46.2)
 *
 * 统一封装 `validateFields(['name']) → aiApi.aiFillForm(...) → form.setFieldsValue(filled)`
 * 的固定流程，消除 CustomerPage / CarModelPage / ProjectPage / FlowsPage 等页面
 * 中 handleAiFill 的逐字重复代码。
 *
 * @example
 *   const { aiFilling, handleAiFill } = useAiFormFiller('customer', form, 'name');
 */
import { useCallback, useState } from 'react';
import { App, FormInstance } from 'antd';
import { aiApi } from '../api';
import { notifyApiError } from '../utils/apiError';

export interface UseAiFormFillerOptions {
  /** 必填字段校验失败时的提示文案 */
  requiredMessage?: string;
  /** 构造额外的 payload（如 brand / customerCode / role 等） */
  extraPayload?: () => Record<string, any>;
  /** 从 AI 返回的 filled 对象提取要 setFieldsValue 的字段（默认原样透传） */
  fieldMapper?: (filled: Record<string, any>) => Record<string, any>;
}

export interface UseAiFormFillerResult {
  aiFilling: boolean;
  handleAiFill: () => Promise<void>;
}

export function useAiFormFiller(
  entityType: string,
  form: FormInstance<any>,
  requiredField: string = 'name',
  options: UseAiFormFillerOptions = {},
): UseAiFormFillerResult {
  const { requiredMessage, extraPayload, fieldMapper } = options;
  const { message } = App.useApp();
  const [aiFilling, setAiFilling] = useState(false);

  const handleAiFill = useCallback(async () => {
    try {
      const v = await form.validateFields([requiredField]);
      const requiredValue = v?.[requiredField];
      if (!requiredValue) {
        message.warning(requiredMessage || `请先输入${requiredField}`);
        return;
      }
      setAiFilling(true);
      const payload: Record<string, any> = { [requiredField]: requiredValue };
      if (extraPayload) Object.assign(payload, extraPayload());
      const r = await aiApi.aiFillForm(entityType, payload);
      if (r?.filled) {
        const fields = fieldMapper ? fieldMapper(r.filled) : r.filled;
        // 过滤掉 undefined 值，避免覆盖已有输入
        const cleaned: Record<string, any> = {};
        for (const [k, val] of Object.entries(fields)) {
          if (val !== undefined) cleaned[k] = val;
        }
        form.setFieldsValue(cleaned);
        message.success(r.reasoning || 'AI 已补全字段');
      }
    } catch (e) {
      notifyApiError(e, 'AI 填充失败：');
    } finally {
      setAiFilling(false);
    }
  }, [form, entityType, requiredField, requiredMessage, extraPayload, fieldMapper, message]);

  return { aiFilling, handleAiFill };
}
