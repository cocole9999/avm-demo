/**
 * V1.48 统一 API 错误处理
 *
 * 消除前端 90+ 处 `catch (e: any) { message.error(e.message) }` 重复代码
 * 支持三种错误来源：
 *   1. axios 响应错误（e.response.data.error）
 *   2. 普通 Error（e.message）
 *   3. antd Form 校验失败（e.errorFields，应被吞咽，不提示）
 */
import { message } from 'antd';

/** 消息实例类型（兼容静态 message 与 App.useApp().message） */
type MessageInstance = typeof message;

/**
 * 从 catch 块的 unknown 错误中提取可读消息
 * - antd Form 校验失败返回 null（应被吞咽）
 * - axios 错误优先取后端返回的 e.response.data.error
 * - 其他错误取 e.message
 */
export function extractApiError(e: unknown, prefix?: string): string | null {
  // antd Form 校验失败：{ errorFields: [...], values: {...} }
  if (e && typeof e === 'object' && 'errorFields' in e) {
    return null;
  }
  let msg = '';
  if (e && typeof e === 'object') {
    const err = e as any;
    // axios 响应错误
    if (err.response?.data?.error) msg = String(err.response.data.error);
    else if (err.message) msg = String(err.message);
    else msg = '未知错误';
  } else if (typeof e === 'string') {
    msg = e;
  } else {
    msg = '未知错误';
  }
  return prefix ? `${prefix}${msg}` : msg;
}

/**
 * 统一通知 API 错误到用户
 * - antd Form 校验失败自动吞咽（返回 false 表示已忽略）
 * - 其他错误调用 message.error
 *
 * @param e catch 块的 unknown 错误
 * @param prefix 错误前缀，如 "保存失败："
 * @param msgInstance 可选的 message 实例（默认用静态 message）
 * @returns true 表示已提示用户；false 表示被吞咽（表单校验失败）
 */
export function notifyApiError(e: unknown, prefix?: string, msgInstance?: MessageInstance): boolean {
  const msg = extractApiError(e, prefix);
  if (msg === null) return false; // 表单校验失败吞咽
  if (msgInstance) msgInstance.error(msg);
  else message.error(msg);
  return true;
}

/**
 * 包装异步函数，自动处理错误通知
 *
 * 用法：
 *   const safeRun = withApiError(() => load(), '加载失败：');
 *   await safeRun();
 *
 * 或在 try/catch 中：
 *   try { await api(); }
 *   catch (e) { notifyApiError(e, '保存失败：'); }
 */
export async function withApiError<T>(
  fn: () => Promise<T>,
  prefix?: string,
  msgInstance?: MessageInstance,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    notifyApiError(e, prefix, msgInstance);
    return undefined;
  }
}
