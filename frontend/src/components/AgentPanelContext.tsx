/**
 * V1.55 Agent 状态上下文（UI 状态，非数据）
 *
 * 管理：
 *   - 当前选中的 Agent (key)
 *   - Agent 面板的展开/折叠
 *   - 当前会话 ID
 *   - 分离/嵌入模式
 */
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

const STORAGE_KEY = 'avm-agent-panel-state-v1';
const URL_PARAM = 'agentSession';

export interface AgentPanelState {
  // 当前选中的 Agent key（'general' | 'project' | ...）
  activeAgentKey: string;
  // Agent 面板是否展开
  panelOpen: boolean;
  // 当前会话 ID（云端持久化）
  sessionId: string | null;
  // Detached 全屏模式（浮在内容之上）
  detached: boolean;
  // 行内模式（嵌入内容区域）
  inline: boolean;
}

export interface AgentPanelContextValue extends AgentPanelState {
  setActiveAgentKey: (key: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setSessionId: (id: string | null) => void;
  toggleDetached: () => void;
  toggleInline: () => void;
}

const defaultState: AgentPanelState = {
  activeAgentKey: 'general',
  panelOpen: false,
  sessionId: null,
  detached: false,
  inline: false,
};

const AgentPanelContext = createContext<AgentPanelContextValue | null>(null);

function readUrlSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(URL_PARAM);
  } catch { return null; }
}

function writeUrlSessionId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set(URL_PARAM, id);
    } else {
      url.searchParams.delete(URL_PARAM);
    }
    window.history.replaceState(null, '', url.toString());
  } catch { /* ignore */ }
}

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentPanelState>(() => {
    if (typeof window === 'undefined') return defaultState;
    let stored: any = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch { /* ignore */ }
    // URL 参数优先级高于 localStorage
    const urlSessionId = readUrlSessionId();
    return {
      ...defaultState,
      ...stored,
      // 如果 URL 有 sessionId，自动打开面板（让用户能直接看到分享的会话）
      panelOpen: urlSessionId ? true : stored.panelOpen ?? defaultState.panelOpen,
      sessionId: urlSessionId || stored.sessionId || null,
    };
  });

  // 持久化到 localStorage + URL
  useEffect(() => {
    try {
      const { sessionId, ...rest } = state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch { /* ignore */ }
    writeUrlSessionId(state.sessionId);
  }, [state]);

  // 监听浏览器前进/后退，同步 URL sessionId
  useEffect(() => {
    const handler = () => {
      const id = readUrlSessionId();
      setState(s => (s.sessionId === id ? s : { ...s, sessionId: id, panelOpen: !!id }));
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const setActiveAgentKey = useCallback((key: string) => {
    setState(s => ({ ...s, activeAgentKey: key, sessionId: null }));
  }, []);

  const togglePanel = useCallback(() => {
    setState(s => ({ ...s, panelOpen: !s.panelOpen }));
  }, []);

  const openPanel = useCallback(() => {
    setState(s => ({ ...s, panelOpen: true }));
  }, []);

  const closePanel = useCallback(() => {
    setState(s => ({ ...s, panelOpen: false }));
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setState(s => ({ ...s, sessionId: id }));
  }, []);

  const toggleDetached = useCallback(() => {
    setState(s => ({ ...s, detached: !s.detached }));
  }, []);

  const toggleInline = useCallback(() => {
    setState(s => ({ ...s, inline: !s.inline }));
  }, []);

  const value: AgentPanelContextValue = {
    ...state,
    setActiveAgentKey,
    togglePanel,
    openPanel,
    closePanel,
    setSessionId,
    toggleDetached,
    toggleInline,
  };

  return <AgentPanelContext.Provider value={value}>{children}</AgentPanelContext.Provider>;
}

export function useAgentPanel(): AgentPanelContextValue {
  const ctx = useContext(AgentPanelContext);
  if (!ctx) {
    return {
      ...defaultState,
      setActiveAgentKey: () => {},
      togglePanel: () => {},
      openPanel: () => {},
      closePanel: () => {},
      setSessionId: () => {},
      toggleDetached: () => {},
      toggleInline: () => {},
    };
  }
  return ctx;
}
