/**
 * V1.55 InlineAskButton — 选中文本时弹出的"问 AI"按钮 + 选区动作菜单
 *
 * 触发：
 *   - 鼠标选中任意页面文字（>= 2 字符）时，在选区右上角弹出浮动按钮
 *   - 点击按钮 → 唤起 Agent 面板，把选中文本注入到输入框
 *   - 提供快捷动作：解释 / 翻译 / 总结 / 提问
 *
 * 设计：
 *   - 监听 document.selectionchange
 *   - 自动定位（用 getBoundingClientRect）
 *   - 滚动/点击外部时自动关闭
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Tooltip, Dropdown, message as antdMessage, theme } from 'antd';
import {
  RobotOutlined, QuestionCircleOutlined, TranslationOutlined,
  FileTextOutlined, ReadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useAgentPanel } from './AgentPanelContext';
import { useLocation } from 'react-router-dom';

const MIN_SELECTION_LENGTH = 2;
const MAX_SELECTION_LENGTH = 8000;

const ACTIONS = [
  { key: 'ask', label: '问问 AI', icon: <QuestionCircleOutlined />, prompt: (text: string) => `请基于以下内容回答我的问题：\n\n${text}` },
  { key: 'explain', label: '解释这段', icon: <ReadOutlined />, prompt: (text: string) => `请详细解释以下内容：\n\n${text}` },
  { key: 'translate', label: '翻译成中文', icon: <TranslationOutlined />, prompt: (text: string) => `请把以下内容翻译成中文：\n\n${text}` },
  { key: 'summary', label: '总结要点', icon: <FileTextOutlined />, prompt: (text: string) => `请用 3-5 个 bullet points 总结以下内容：\n\n${text}` },
];

export function InlineAskButton() {
  const { token } = theme.useToken();
  const panel = useAgentPanel();
  const location = useLocation();
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [hidden, setHidden] = useState(false);
  const lastSelectionTextRef = useRef('');

  // 监听选区变化
  useEffect(() => {
    const handler = () => {
      // 排除输入框/可编辑元素内的选区
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
        setSelection(null);
        return;
      }
      // 选区必须在 agent 面板外（避免面板内文本触发）
      const anchor = sel.anchorNode?.parentElement;
      if (anchor?.closest('[data-agent-pane="true"]')) {
        setSelection(null);
        return;
      }
      // 节流：相同文本不重置位置
      if (text === lastSelectionTextRef.current && selection) return;
      lastSelectionTextRef.current = text;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }
      setSelection({ text, rect });
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [selection]);

  // 滚动时关闭
  useEffect(() => {
    const onScroll = () => setSelection(null);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  // 路由变化时关闭
  useEffect(() => {
    setSelection(null);
  }, [location.pathname]);

  // 点击外部关闭
  useEffect(() => {
    if (!selection) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-inline-ask="true"]')) return;
      setSelection(null);
    };
    setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => document.removeEventListener('click', onClick);
  }, [selection]);

  // 唤起 Agent 面板并把文本注入到上下文（通过 sessionStorage 传递）
  const ask = useCallback((promptText: string) => {
    try {
      // 把 prompt 暂存到 sessionStorage，AgentPane 检测到后自动填入并发送
      sessionStorage.setItem('avm-agent-pending-prompt', promptText);
      sessionStorage.setItem('avm-agent-pending-source', 'inline-ask');
    } catch { /* ignore */ }
    panel.openPanel();
    setSelection(null);
    antdMessage.success('已唤起 AI 助理，正在准备回答…');
  }, [panel]);

  if (hidden || !selection) return null;

  // 位置：选区右上方 8px
  const top = Math.max(8, selection.rect.top - 40 + window.scrollY);
  const left = Math.max(8, selection.rect.right - 200 + window.scrollX);

  const items = ACTIONS.map(a => ({
    key: a.key,
    icon: a.icon,
    label: a.label,
    onClick: () => ask(a.prompt(selection.text)),
  }));

  return (
    <div
      data-inline-ask="true"
      style={{
        position: 'absolute',
        top: selection.rect.top - 40,
        left: selection.rect.right - 100,
        zIndex: 1500,
        display: 'flex',
        gap: 4,
        padding: 4,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.preventDefault()} // 防止点击关闭选区
    >
      <Dropdown
        menu={{ items }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Tooltip title="选区动作（解释/翻译/总结）">
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
          >
            问 AI
          </Button>
        </Tooltip>
      </Dropdown>
      <Tooltip title="关闭">
        <Button
          size="small"
          type="text"
          onClick={() => { setSelection(null); setHidden(true); setTimeout(() => setHidden(false), 1000); }}
        >
          ×
        </Button>
      </Tooltip>
    </div>
  );
}

/**
 * AgentPendingPromptBridge — 监听 sessionStorage 中的待发送 prompt
 *
 * 由 AgentPane 在挂载时注册，检测到 `avm-agent-pending-prompt` 后填入输入框
 */
export function useAgentPendingPrompt(): { pendingPrompt: string | null; consume: () => string | null } {
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      try {
        const p = sessionStorage.getItem('avm-agent-pending-prompt');
        if (p) setPendingPrompt(p);
      } catch { /* ignore */ }
    };
    check();
    const t = setInterval(check, 500);
    return () => clearInterval(t);
  }, []);

  const consume = useCallback(() => {
    try {
      const p = sessionStorage.getItem('avm-agent-pending-prompt');
      sessionStorage.removeItem('avm-agent-pending-prompt');
      sessionStorage.removeItem('avm-agent-pending-source');
      setPendingPrompt(null);
      return p;
    } catch { return null; }
  }, []);

  return { pendingPrompt, consume };
}
