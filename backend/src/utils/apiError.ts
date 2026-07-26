/**
 * V1.55 统一 API 错误处理工具
 *
 * 用途：
 *   - 集中处理 catch 块中的错误响应
 *   - 统一返回结构：{ error, code?, details? }
 *   - 在开发环境暴露原始错误，生产环境脱敏
 */

import { Response } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** 从任意错误对象中提取 message */
export function extractApiError(e: any): { message: string; code?: string; stack?: string } {
  if (!e) return { message: '未知错误' };
  if (typeof e === 'string') return { message: e };
  if (e instanceof Error) {
    return { message: e.message, code: (e as any).code, stack: e.stack };
  }
  if (typeof e === 'object') {
    return {
      message: e.message || e.error || JSON.stringify(e),
      code: e.code,
      stack: e.stack,
    };
  }
  return { message: String(e) };
}

/** 统一处理 API 错误并返回 500 响应 */
export function notifyApiError(res: Response, e: any, fallbackMessage: string): void {
  const { message, code, stack } = extractApiError(e);
  const payload: Record<string, any> = {
    error: IS_PRODUCTION ? fallbackMessage : message || fallbackMessage,
  };
  if (code) payload.code = code;
  if (!IS_PRODUCTION && stack) payload.details = stack;
  res.status(500).json(payload);
}

/** 处理 4xx 业务错误（保留原始 message 因为通常是用户可读的） */
export function notifyClientError(res: Response, status: number, message: string, code?: string): void {
  const payload: Record<string, any> = { error: message };
  if (code) payload.code = code;
  res.status(status).json(payload);
}
