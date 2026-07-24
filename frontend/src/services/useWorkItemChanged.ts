/**
 * V1.47: 订阅 work_item_changed 事件，AI 修改工作项后自动刷新相关页面
 *
 * 用法：
 *   useWorkItemChanged(() => { load(); }, { key: item?.key });
 *   useWorkItemChanged(() => { load(); });  // 任何工作项变更都刷新
 */
import { useEffect, useRef } from 'react';
import { wsClient } from './ws';

type WSMessage = { type: string; [k: string]: any };

export function useWorkItemChanged(
  onRefresh: () => void,
  opts?: { key?: string; id?: string; skip?: boolean }
) {
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    if (opts?.skip) return;
    const handler = (msg: WSMessage) => {
      if (msg.type !== 'work_item_changed') return;
      console.log('[useWorkItemChanged] 收到事件:', msg, 'opts:', opts);
      // 如果指定了 key/id，只刷新匹配的工作项
      if (opts?.key && msg.key !== opts.key && opts?.id && msg.id !== opts.id) return;
      if (opts?.id && msg.id !== opts.id) return;
      if (opts?.key && msg.key !== opts.key) return;
      // 收到变更事件后刷新
      console.log('[useWorkItemChanged] 触发刷新');
      callbackRef.current();
    };
    const off = wsClient.on('work_item_changed', handler);
    console.log('[useWorkItemChanged] 已订阅 work_item_changed, opts:', opts);
    return off;
  }, [opts?.key, opts?.id, opts?.skip]);
}
