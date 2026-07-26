/**
 * V1.55 Agent 面板 — 嵌入到导航栏与右侧 view 之间的专用 Agent 容器
 *
 * 布局：左侧 Sider (导航) | 中间 Content (页面) | 右侧 AgentPane
 * 顶部：Agent 切换 + 模型选择 + 会话菜单
 * 中部：消息列表（Markdown 渲染）
 * 底部：输入框 + 附件 + 工具
 * 左侧 4px 拖拽条可调宽度（持久化）
 * 支持 Detached 全屏浮层
 * Ctrl+U 切换显示/隐藏
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Spin, Tag, Tooltip, message as antdMessage, theme, Space, Empty, Dropdown } from 'antd';
import {
  CloseOutlined, FullscreenOutlined, FullscreenExitOutlined,
  SendOutlined, StopOutlined, ClearOutlined, ThunderboltOutlined,
  ReloadOutlined, MessageOutlined, RobotOutlined, BranchesOutlined,
  ToolOutlined, CodeOutlined, MoreOutlined,
  ProjectOutlined, UnorderedListOutlined, SnippetsOutlined, AlertOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useAgentPanel } from './AgentPanelContext';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { useAgentChat } from '../hooks/useAgentChat';
import { ModelSelector } from './ModelSelector';
import { MarkdownContent } from './MarkdownContent';
import { SessionMenu } from './SessionMenu';
import { useAgentPendingPrompt } from './InlineAskButton';
import { MessageFeedbackBar } from './MessageFeedbackBar';
import { agentsApi, agentSessionsApi, type Agent as AgentType, type AgentSession } from '../api';

const { useToken } = theme;
const { TextArea } = Input;

// V1.55.13: kbd 标签样式（用于空状态快捷键提示）
const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 4,
  border: '1px solid var(--ant-color-border, #d9d9d9)',
  background: 'var(--ant-color-bg-container, #fff)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 11,
  lineHeight: '14px',
  color: 'var(--ant-color-text-secondary, #666)',
  boxShadow: '0 1px 0 var(--ant-color-border-secondary, #f0f0f0)',
  margin: '0 2px',
};

// V1.55.7: 6 个专用 Agent 图标设计（圆形彩色背景 + 居中 antd 图标）
// 视觉更专业、辨识度更高，与侧边栏导航风格一致
function agentIconNode(key: string, emoji: string, size: number = 14, badge: boolean = false): React.ReactNode {
  const map: Record<string, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
    general:  { icon: <RobotOutlined />,         bg: '#e6f4ff', color: '#1677ff', label: '通用' },  // 通用 - 机器人蓝
    project:  { icon: <ProjectOutlined />,       bg: '#e6fffb', color: '#13c2c2', label: '项目' },  // 项目 - 项目青
    workItem: { icon: <UnorderedListOutlined />, bg: '#fff7e6', color: '#fa8c16', label: '工作项' }, // 工作项 - 列表橙
    report:   { icon: <SnippetsOutlined />,      bg: '#f9f0ff', color: '#722ed1', label: '报告' },  // 报告 - 报告紫
    risk:     { icon: <AlertOutlined />,         bg: '#fff1f0', color: '#f5222d', label: '风险' },  // 风险 - 警告红
    review:   { icon: <MessageOutlined />,       bg: '#f6ffed', color: '#52c41a', label: '评审' },  // 评审 - 消息绿
  };
  const item = map[key] || { icon: <RobotOutlined />, bg: '#e6f4ff', color: '#1677ff', label: 'Agent' };
  if (badge) {
    // 完整徽章：圆形彩色背景 + 居中图标（用于 Tab/顶部/空状态）
    return (
      <span
        title={emoji || item.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 8,
          height: size + 8,
          borderRadius: '50%',
          background: item.bg,
          color: item.color,
          fontSize: size,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </span>
    );
  }
  // 紧凑型：仅图标（用于按钮内）
  return (
    <span
      title={emoji || item.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: item.color,
        fontSize: size,
        lineHeight: 1,
        verticalAlign: 'middle',
      }}
    >
      {item.icon}
    </span>
  );
}

// V1.55.13: 获取 Agent 的主题色（用于空状态大头像背景）
function agentColor(key: string): { bg: string; fg: string; shadow: string } {
  const map: Record<string, { bg: string; fg: string; shadow: string }> = {
    general:  { bg: '#e6f4ff', fg: '#1677ff', shadow: 'rgba(22,119,255,0.18)' },
    project:  { bg: '#e6fffb', fg: '#13c2c2', shadow: 'rgba(19,194,194,0.18)' },
    workItem: { bg: '#fff7e6', fg: '#fa8c16', shadow: 'rgba(250,140,22,0.18)' },
    report:   { bg: '#f9f0ff', fg: '#722ed1', shadow: 'rgba(114,46,209,0.18)' },
    risk:     { bg: '#fff1f0', fg: '#f5222d', shadow: 'rgba(245,34,45,0.18)' },
    review:   { bg: '#f6ffed', fg: '#52c41a', shadow: 'rgba(82,196,26,0.18)' },
  };
  return map[key] || { bg: '#e6f4ff', fg: '#1677ff', shadow: 'rgba(22,119,255,0.18)' };
}

function pageNameFromPath(path: string): string {
  if (!path) return '首页';
  if (path === '/' || path === '/workbench') return '工作台';
  if (path === '/dashboard') return '项目仪表盘';
  if (path.startsWith('/work-items/')) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 3) return `工作项详情 (${parts[1]})`;
    return '工作项列表';
  }
  if (path.startsWith('/projects')) return '项目列表';
  if (path.startsWith('/customers')) return '客户列表';
  if (path.startsWith('/work-items')) return '工作项列表';
  if (path.startsWith('/reviews')) return '评审列表';
  if (path.startsWith('/dashboards')) return '仪表盘';
  if (path.startsWith('/reports')) return '报告中心';
  if (path.startsWith('/notifications')) return '通知中心';
  if (path.startsWith('/llm-settings')) return 'LLM 设置';
  if (path.startsWith('/mcp')) return 'MCP 设置';
  return path;
}

export function AgentPane() {
  const { token } = useToken();
  const location = useLocation();
  const panel = useAgentPanel();
  const { width, isResizing, startResize } = useResizablePanel({
    storageKey: 'avm-agent-panel-width',
    defaultWidth: 400,
    minWidth: 280,
    maxWidth: 720,
  });
  const [agents, setAgents] = useState<AgentType[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | undefined>();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pageContext = useMemo(() => ({
    pathname: location.pathname,
    pageName: pageNameFromPath(location.pathname),
  }), [location.pathname]);

  const activeAgent = agents.find(a => a.key === panel.activeAgentKey) || null;

  // 拉取 Agent 列表
  useEffect(() => {
    if (!panel.panelOpen) return;
    setLoadingAgents(true);
    agentsApi.list()
      .then(list => {
        setAgents(list);
        if (list.length > 0 && !list.find(a => a.key === panel.activeAgentKey)) {
          panel.setActiveAgentKey(list[0].key);
        }
      })
      .catch(e => antdMessage.error('加载 Agent 列表失败: ' + (e?.message || '')))
      .finally(() => setLoadingAgents(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.panelOpen]);

  // 接入 useAgentChat
  const { messages, loading, sendMessage, abort, clear } = useAgentChat({
    agent: activeAgent,
    sessionId: panel.sessionId,
    onSessionCreated: (s: AgentSession) => panel.setSessionId(s.id),
    pageContext,
  });

  // V1.55.4: 处理 InlineAskButton 划词后的 pending prompt
  const { pendingPrompt, consume } = useAgentPendingPrompt();
  useEffect(() => {
    if (pendingPrompt && activeAgent && !loading) {
      sendMessage(pendingPrompt);
      consume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, activeAgent, loading]);

  // V1.55.4: 处理 SessionMenu 选中
  const handleSessionSelect = (s: AgentSession) => {
    // 切换会话时，如果 Agent 不同则同时切换
    if (s.agent && s.agent.key !== panel.activeAgentKey) {
      panel.setActiveAgentKey(s.agent.key);
    }
    panel.setSessionId(s.id);
  };

  // V1.55.4: 新建会话（清空 sessionId）
  const handleNewSession = () => {
    panel.setSessionId(null);
    clear();
  };

  // V1.55.4: URL ?agentSession=xxx 进入时，加载完 session 后切换 agent
  useEffect(() => {
    if (panel.sessionId && !panel.sessionId.startsWith('temp_')) {
      agentSessionsApi.get(panel.sessionId)
        .then(s => {
          if (s.agent && s.agent.key !== panel.activeAgentKey) {
            panel.setActiveAgentKey(s.agent.key);
          }
        })
        .catch(() => { /* ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.sessionId]);

  // 自动滚动到底部
  useEffect(() => {
    if (panel.panelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, panel.panelOpen]);

  if (!panel.panelOpen) return null;

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const paneContent = (
    <div style={{
      width: panel.detached ? 'min(720px, 90vw)' : width,
      height: panel.detached ? 'min(80vh, 720px)' : '100%',
      maxHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: token.colorBgContainer,
      borderLeft: panel.detached ? 'none' : `1px solid ${token.colorBorderSecondary}`,
      borderRadius: panel.detached ? 12 : 0,
      boxShadow: panel.detached ? '0 12px 40px rgba(0,0,0,0.18)' : 'none',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* V1.55.13: 顶部栏 — 紧凑、单行、去掉冗余 Agent 徽章 */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        minWidth: 0,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 8,
          background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 100%)`,
          border: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}>
          <ThunderboltOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>AI 助理</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }} />
        {width >= 360 && (
          <div style={{ flexShrink: 0 }}>
            <ModelSelector value={selectedModel} onChange={(p, m) => setSelectedModel({ provider: p, model: m })} />
          </div>
        )}
        <SessionMenu
          agentId={activeAgent?.id}
          currentSessionId={panel.sessionId}
          onSelect={handleSessionSelect}
          onNew={handleNewSession}
        />
        <Tooltip title="清空对话">
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={() => { clear(); panel.setSessionId(null); }} disabled={messages.length === 0} />
        </Tooltip>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'refresh', icon: <ReloadOutlined />, label: '刷新 Agent 列表', onClick: () => {
                setLoadingAgents(true);
                agentsApi.list().then(setAgents).finally(() => setLoadingAgents(false));
              } },
              { key: 'detach', icon: panel.detached ? <FullscreenExitOutlined /> : <FullscreenOutlined />, label: panel.detached ? '嵌入页面' : '分离浮窗', onClick: panel.toggleDetached },
              { type: 'divider' as const },
              { key: 'close', icon: <CloseOutlined />, label: '关闭面板 (Ctrl+U)', onClick: panel.closePanel, danger: true },
            ],
          }}
        >
          <Tooltip title="更多">
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Tooltip>
        </Dropdown>
      </div>

      {/* V1.55.13: Agent 切换 — Segmented 风格 chip（精致、悬停过渡） */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        background: token.colorBgLayout,
      }}>
        {loadingAgents ? (
          <Spin size="small" />
        ) : (
          agents.filter(a => a.enabled).map(a => {
            const isActive = panel.activeAgentKey === a.key;
            const c = agentColor(a.key);
            return (
              <Tooltip key={a.key} title={a.description} mouseEnterDelay={0.4}>
                <div
                  onClick={() => panel.setActiveAgentKey(a.key)}
                  className="avm-agent-chip"
                  data-active={isActive ? '1' : '0'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 11px 5px 7px',
                    borderRadius: 14,
                    background: isActive ? c.bg : 'transparent',
                    color: isActive ? c.fg : token.colorTextSecondary,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.18s ease',
                    border: isActive ? `1px solid ${c.fg}30` : '1px solid transparent',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.background = token.colorFillTertiary;
                      (e.currentTarget as HTMLDivElement).style.color = token.colorText;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      (e.currentTarget as HTMLDivElement).style.color = token.colorTextSecondary;
                    }
                  }}
                >
                  {agentIconNode(a.key, a.icon, 12, !isActive)}
                  <span>{a.name}</span>
                </div>
              </Tooltip>
            );
          })
        )}
      </div>

      {/* V1.55.13: 消息区 — 精致气泡 + 优雅空状态 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, background: token.colorBgLayout }}>
        {messages.length === 0 ? (
          <div style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 72,
          }}>
            {/* 大圆头像（带主题色阴影） */}
            {activeAgent ? (() => {
              const c = agentColor(activeAgent.key);
              return (
                <div style={{
                  width: 72, height: 72,
                  borderRadius: 20,
                  background: `linear-gradient(135deg, ${c.bg} 0%, #ffffff 100%)`,
                  border: `1px solid ${c.fg}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                  boxShadow: `0 6px 20px ${c.shadow}`,
                }}>
                  {agentIconNode(activeAgent.key, activeAgent.icon, 30, true)}
                </div>
              );
            })() : (
              <div style={{
                width: 72, height: 72,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, #ffffff 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
                boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
              }}>
                <RobotOutlined style={{ fontSize: 32, color: token.colorPrimary }} />
              </div>
            )}
            {/* 标题 + 描述 */}
            <div style={{ fontSize: 16, fontWeight: 600, color: token.colorText, marginBottom: 8, letterSpacing: 0.2 }}>
              {activeAgent ? activeAgent.name : 'AI 助理'}
            </div>
            <div style={{ fontSize: 13, color: token.colorTextTertiary, maxWidth: 280, textAlign: 'center', lineHeight: 1.7, marginBottom: 22 }}>
              {activeAgent?.description || '选择 Agent 后开始对话'}
            </div>
            {/* 分隔线 */}
            <div style={{ width: 36, height: 2, borderRadius: 1, background: token.colorBorderSecondary, marginBottom: 22 }} />
            {/* 快捷键提示 */}
            <div style={{ fontSize: 12, color: token.colorTextQuaternary, textAlign: 'center', lineHeight: 1.9 }}>
              <div>当前页面：<span style={{ color: token.colorTextTertiary }}>{pageContext.pageName}</span></div>
              <div style={{ marginTop: 6 }}>
                按 <kbd style={kbdStyle}>Enter</kbd> 发送，<kbd style={kbdStyle}>Shift+Enter</kbd> 换行
              </div>
            </div>
          </div>
        ) : (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    padding: '9px 13px',
                    borderRadius: 10,
                    background: m.role === 'user' ? token.colorPrimary : token.colorBgContainer,
                    color: m.role === 'user' ? '#fff' : token.colorText,
                    border: m.role === 'ai' ? `1px solid ${token.colorBorderSecondary}` : 'none',
                    fontSize: 13,
                    lineHeight: 1.65,
                    wordBreak: 'break-word',
                    boxShadow: m.role === 'user' ? `0 2px 8px ${token.colorPrimary}30` : '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* 工具调用记录 */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <details style={{ marginBottom: 6, fontSize: 11, opacity: 0.85 }}>
                      <summary style={{ cursor: 'pointer', color: m.role === 'user' ? 'rgba(255,255,255,0.85)' : token.colorTextSecondary }}>
                        <ToolOutlined /> 调用了 {m.toolCalls.length} 个工具
                      </summary>
                      <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${m.role === 'user' ? 'rgba(255,255,255,0.3)' : token.colorBorderSecondary}` }}>
                        {m.toolCalls.map((tc, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <Tag color={tc.error ? 'red' : 'green'} style={{ fontSize: 10 }}>
                              {tc.error ? '✗' : '✓'} {tc.name}
                            </Tag>
                            {tc.error && <span style={{ color: m.role === 'user' ? '#ffd6d6' : token.colorError, fontSize: 11 }}> {tc.error}</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {/* 消息内容（Markdown 渲染） */}
                  {m.pending ? (
                    <span style={{ color: m.role === 'user' ? 'rgba(255,255,255,0.85)' : token.colorTextTertiary }}>
                      <Spin size="small" style={{ marginRight: 6 }} />
                      思考中…
                    </span>
                  ) : m.role === 'ai' ? (
                    <>
                      <MarkdownContent content={m.content} />
                      {/* V1.55.6: AI 消息反馈按钮 */}
                      {!m.pending && panel.sessionId && (
                        <MessageFeedbackBar
                          sessionId={panel.sessionId}
                          messageId={m.id}
                        />
                      )}
                    </>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  )}
                  <div style={{ fontSize: 10, color: m.role === 'user' ? 'rgba(255,255,255,0.65)' : token.colorTextTertiary, marginTop: 4, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </Space>
        )}
      </div>

      {/* V1.55.13: 底部输入区 — 圆角容器 + 精致按钮 + 简洁提示 */}
      <div style={{
        padding: 10,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        flexShrink: 0,
        flexGrow: 0,
      }}>
        <div style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 12,
          padding: 2,
          background: token.colorBgContainer,
          transition: 'all 0.2s',
        }}
        onFocusCapture={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = token.colorPrimary;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${token.colorPrimaryBg}`;
        }}
        onBlurCapture={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = token.colorBorderSecondary;
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
        >
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeAgent ? `向 ${activeAgent.name} 提问...` : '请先选择 Agent'}
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={!activeAgent || loading}
            variant="borderless"
            style={{ padding: '8px 10px', fontSize: 13, resize: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '0 2px' }}>
          <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: 1 }}>
            {activeAgent ? `${activeAgent.allowedTools?.length || 0} 个工具可用 · Enter 发送 · Shift+Enter 换行` : '请先选择 Agent'}
          </span>
          {loading ? (
            <Button
              type="primary"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={abort}
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!input.trim() || !activeAgent}
              style={{ borderRadius: 8 }}
            >
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // 拖拽条
  const resizeHandle = !panel.detached ? (
    <div
      onMouseDown={startResize}
      style={{
        width: 4,
        cursor: 'ew-resize',
        background: isResizing ? token.colorPrimary : 'transparent',
        transition: isResizing ? 'none' : 'background 0.2s',
        flexShrink: 0,
        marginLeft: -2,
        marginRight: -2,
        zIndex: 10,
      }}
      onMouseEnter={(e) => {
        if (!isResizing) (e.currentTarget as HTMLDivElement).style.background = token.colorPrimary + '40';
      }}
      onMouseLeave={(e) => {
        if (!isResizing) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
      title="拖拽调整宽度"
      role="separator"
      aria-orientation="vertical"
    />
  ) : null;

  if (panel.detached) {
    return (
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1000 }} role="dialog" aria-label="AI 助理（分离模式）">
        {paneContent}
      </div>
    );
  }

  return (
    <>
      {resizeHandle}
      <aside
        data-agent-pane="true"
        style={{
          display: 'flex',
          width,
          flexShrink: 0,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
        }}
        role="complementary"
        aria-label="AI 助理面板"
      >
        {paneContent}
      </aside>
    </>
  );
}
