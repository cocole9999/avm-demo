/**
 * SlashCommandMenu - / 命令菜单组件 (V1.44)
 *
 * 当用户在输入框输入 / 时弹出命令选择菜单，
 * 支持模糊搜索、分类筛选、参数输入。
 * 参照 Trae Work Agent 的 / 命令交互模式。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Tag, Spin, Empty, type InputRef } from 'antd';
import {
  ThunderboltOutlined, FolderOutlined, BarChartOutlined, FileTextOutlined,
  SettingOutlined, RobotOutlined, SearchOutlined, ArrowRightOutlined,
} from '@ant-design/icons';

// ============================================================
// 类型定义
// ============================================================

export interface SlashCommand {
  name: string;
  alias?: string[];
  description: string;
  category: 'work' | 'project' | 'analysis' | 'report' | 'admin' | 'ai';
  hint?: string;
  params: SlashCommandParam[];
}

export interface SlashCommandParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'date' | 'user';
  description: string;
  required?: boolean;
  options?: string[];
  default?: any;
}

export interface CommandResult {
  ok: boolean;
  title: string;
  content: string;
  data?: any;
  actions?: { label: string; command: string; args?: Record<string, any> }[];
}

// ============================================================
// 分类配置
// ============================================================

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  work: { icon: <ThunderboltOutlined />, label: '工作项', color: '#1677ff' },
  project: { icon: <FolderOutlined />, label: '项目', color: '#52c41a' },
  analysis: { icon: <BarChartOutlined />, label: '分析', color: '#fa8c16' },
  report: { icon: <FileTextOutlined />, label: '报告', color: '#722ed1' },
  admin: { icon: <SettingOutlined />, label: '管理', color: '#8c8c8c' },
  ai: { icon: <RobotOutlined />, label: 'AI', color: '#eb2f96' },
};

// ============================================================
// 组件
// ============================================================

interface SlashCommandMenuProps {
  visible: boolean;
  query: string;           // / 后面的搜索文本
  position: { top: number; left: number };
  onSelect: (command: string, args: Record<string, any>) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ visible, query, position, onSelect, onClose }: SlashCommandMenuProps) {
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [paramMode, setParamMode] = useState<SlashCommand | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const inputRef = useRef<InputRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 加载命令列表
  useEffect(() => {
    if (!visible || paramMode) return;
    setLoading(true);
    const url = query
      ? `/api/agent/commands/search?q=${encodeURIComponent(query)}`
      : '/api/agent/commands';
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setCommands(d.commands || []);
        setSelectedIdx(0);
      })
      .catch(() => setCommands([]))
      .finally(() => setLoading(false));
  }, [query, visible, paramMode]);

  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (paramMode) { setParamMode(null); setParamValues({}); }
      else onClose();
      return;
    }

    if (paramMode) {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeWithParams();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = commands[selectedIdx];
      if (cmd) selectCommand(cmd);
    }
  }, [visible, paramMode, commands, selectedIdx, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  const selectCommand = (cmd: SlashCommand) => {
    if (cmd.params.length > 0 && cmd.params.some(p => p.required)) {
      // 有必填参数 → 进入参数输入模式
      setParamMode(cmd);
      const defaults: Record<string, string> = {};
      for (const p of cmd.params) {
        if (p.default !== undefined) defaults[p.name] = String(p.default);
      }
      setParamValues(defaults);
      setSelectedIdx(0);
    } else {
      // 无参数 → 直接执行
      onSelect(cmd.name, {});
      onClose();
    }
  };

  const executeWithParams = () => {
    if (!paramMode) return;
    const args: Record<string, any> = {};
    for (const p of paramMode.params) {
      const val = paramValues[p.name] || '';
      if (p.type === 'number') args[p.name] = val ? Number(val) : undefined;
      else if (p.type === 'boolean') args[p.name] = val === 'true' || val === '1';
      else args[p.name] = val || undefined;
    }
    onSelect(paramMode.name, args);
    setParamMode(null);
    setParamValues({});
    onClose();
  };

  if (!visible) return null;

  // 参数输入模式
  if (paramMode) {
    const cat = CATEGORY_CONFIG[paramMode.category];
    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed', top: position.top, left: position.left,
          width: 420, maxHeight: 500, background: '#fff',
          borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
          border: '1px solid #f0f0f0', zIndex: 9999, overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: cat.color }}>{cat.icon}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{paramMode.name}</span>
            <Tag color={cat.color} style={{ margin: 0 }}>{cat.label}</Tag>
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>{paramMode.description}</div>
        </div>

        {/* 参数表单 */}
        <div style={{ padding: 16, overflowY: 'auto', maxHeight: 350 }}>
          {paramMode.params.map((p, i) => (
            <div key={p.name} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#333', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{p.description}</span>
                {p.required && <span style={{ color: '#f5222d' }}>*</span>}
                {p.type === 'select' && p.options && (
                  <span style={{ color: '#999', fontSize: 11 }}>({p.options.join(' / ')})</span>
                )}
              </div>
              {p.type === 'select' ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.options?.map(opt => (
                    <Tag.CheckableTag
                      key={opt}
                      checked={paramValues[p.name] === opt}
                      onChange={() => setParamValues(v => ({ ...v, [p.name]: opt }))}
                      style={{ cursor: 'pointer', margin: 0 }}
                    >
                      {opt}
                    </Tag.CheckableTag>
                  ))}
                </div>
              ) : (
                <Input
                  ref={i === 0 ? inputRef : undefined}
                  value={paramValues[p.name] || ''}
                  onChange={e => setParamValues(v => ({ ...v, [p.name]: e.target.value }))}
                  placeholder={p.description}
                  size="small"
                  onPressEnter={executeWithParams}
                />
              )}
            </div>
          ))}
        </div>

        {/* 底部操作 */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#999' }}>Enter 执行 · Esc 取消</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#999', cursor: 'pointer' }} onClick={() => { setParamMode(null); setParamValues({}); }}>
              返回
            </span>
            <span
              style={{
                fontSize: 12, color: '#fff', background: '#1677ff', padding: '4px 16px',
                borderRadius: 6, cursor: 'pointer',
              }}
              onClick={executeWithParams}
            >
              执行
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 命令列表模式
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', top: position.top, left: position.left,
        width: 420, maxHeight: 400, background: '#fff',
        borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        border: '1px solid #f0f0f0', zIndex: 9999, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 搜索提示 */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchOutlined style={{ color: '#999' }} />
        <span style={{ fontSize: 13, color: '#666' }}>
          {query ? `搜索 "${query}"` : '输入命令或关键词'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>
          {commands.length} 个命令
        </span>
      </div>

      {/* 命令列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : commands.length === 0 ? (
          <Empty description="未找到匹配的命令" style={{ padding: 24 }} />
        ) : (
          commands.map((cmd, i) => {
            const cat = CATEGORY_CONFIG[cmd.category];
            const isSelected = i === selectedIdx;
            return (
              <div
                key={cmd.name}
                onClick={() => selectCommand(cmd)}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  padding: '10px 16px', cursor: 'pointer',
                  background: isSelected ? '#f0f5ff' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ color: cat.color, fontSize: 16, width: 20, textAlign: 'center' }}>
                  {cat.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: '#333' }}>
                      /{cmd.name}
                    </span>
                    {cmd.alias && cmd.alias.length > 0 && (
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {cmd.alias.slice(0, 2).join(' / ')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cmd.description}
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 12 }} />
              </div>
            );
          })
        )}
      </div>

      {/* 底部提示 */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#bbb', display: 'flex', justifyContent: 'space-between' }}>
        <span>↑↓ 导航 · Enter 选择 · Esc 关闭</span>
        <span>输入 / 触发命令</span>
      </div>
    </div>
  );
}
