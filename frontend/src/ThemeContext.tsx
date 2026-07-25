// V1.50: 暗色主题切换 Context
// 提供 light / dark 主题切换，状态持久化到 localStorage

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'avm-theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 读取 localStorage 中的主题偏好（兼容 SSR / localStorage 不可用场景） */
function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage 不可用 */
  }
  // 跟随系统偏好
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  // 同步到 <html data-theme> 与 localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* 静默失败 */
    }
  }, [mode]);

  // 监听系统主题变化（仅在用户未显式设置时）
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return; // 用户已显式设置
      } catch { /* ignore */ }
      setModeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggle = useCallback(() => {
    setModeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    isDark: mode === 'dark',
    setMode,
    toggle,
  }), [mode, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 兜底：未包裹 ThemeProvider 时返回 light 默认值
    return {
      mode: 'light',
      isDark: false,
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/** antd ConfigProvider 主题：暗色/亮色 token */
export function getAntdTheme(mode: ThemeMode) {
  if (mode === 'dark') {
    return {
      algorithm: undefined, // 实际在 ConfigProvider 中使用 theme.darkAlgorithm
      token: {
        colorBgBase: '#141414',
        colorTextBase: '#e6e6e6',
        colorBgContainer: '#1f1f1f',
        colorBgElevated: '#262626',
        colorBorder: '#303030',
        colorBorderSecondary: '#262626',
        colorPrimary: '#1677ff',
      },
    };
  }
  return {
    token: {
      colorPrimary: '#1677ff',
    },
  };
}
