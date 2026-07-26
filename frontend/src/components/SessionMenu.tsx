/**
 * V1.55 SessionMenu — 会话管理菜单
 *
 * 功能：
 *   - 列出我的会话（按当前 Agent 过滤）
 *   - 新建会话
 *   - 切换会话
 *   - Fork 会话（复制历史 + 重命名）
 *   - 删除会话
 *   - 复制 URL 分享
 */
import { useEffect, useState } from 'react';
import { Dropdown, Button, List, Empty, Spin, Space, Tag, Modal, Input, message as antdMessage, Popconfirm, Tooltip, theme } from 'antd';
import {
  HistoryOutlined, PlusOutlined, BranchesOutlined, DeleteOutlined,
  LinkOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { agentSessionsApi, type AgentSession } from '../api';
import { notifyApiError } from '../utils/apiError';

const { useToken } = theme;

export interface SessionMenuProps {
  agentId: string | undefined;
  currentSessionId: string | null;
  onSelect: (session: AgentSession) => void;
  onNew: () => void;
  size?: 'small' | 'middle';
}

export function SessionMenu({ agentId, currentSessionId, onSelect, onNew, size = 'small' }: SessionMenuProps) {
  const { token } = useToken();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AgentSession | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // 打开时拉取
  useEffect(() => {
    if (!open || !agentId) return;
    setLoading(true);
    agentSessionsApi.list({ agentId, limit: 50 })
      .then(setSessions)
      .catch(e => notifyApiError(e, '加载会话列表失败'))
      .finally(() => setLoading(false));
  }, [open, agentId]);

  const handleFork = async (s: AgentSession) => {
    try {
      const forked = await agentSessionsApi.fork(s.id);
      antdMessage.success('已 Fork 会话');
      onSelect(forked);
      setOpen(false);
    } catch (e) {
      notifyApiError(e, 'Fork 失败');
    }
  };

  const handleDelete = async (s: AgentSession) => {
    try {
      await agentSessionsApi.remove(s.id);
      setSessions(prev => prev.filter(x => x.id !== s.id));
      if (currentSessionId === s.id) onNew();
      antdMessage.success('已删除');
    } catch (e) {
      notifyApiError(e, '删除失败');
    }
  };

  const handleCopyUrl = (s: AgentSession) => {
    const url = new URL(window.location.href);
    url.searchParams.set('agentSession', s.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      antdMessage.success('已复制分享链接');
    }).catch(() => {
      Modal.info({
        title: '分享链接',
        content: (
          <Input.TextArea readOnly value={url.toString()} autoSize={{ minRows: 2, maxRows: 4 }} />
        ),
      });
    });
  };

  const handleRename = async () => {
    if (!renameTarget || !newTitle.trim()) return;
    try {
      await agentSessionsApi.update(renameTarget.id, { title: newTitle.trim() });
      setSessions(prev => prev.map(s => s.id === renameTarget.id ? { ...s, title: newTitle.trim() } : s));
      antdMessage.success('已重命名');
      setRenameTarget(null);
      setNewTitle('');
    } catch (e) {
      notifyApiError(e, '重命名失败');
    }
  };

  const panel = (
    <div style={{
      width: 360, background: token.colorBgContainer, borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 8, maxHeight: 480, overflow: 'auto',
    }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>会话历史（{sessions.length}）</span>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => { onNew(); setOpen(false); }}
        >
          新建
        </Button>
      </Space>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
      ) : sessions.length === 0 ? (
        <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={sessions}
          renderItem={(s) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 4,
                background: s.id === currentSessionId ? token.colorPrimaryBg : 'transparent',
              }}
              onClick={() => { onSelect(s); setOpen(false); }}
              actions={[
                <Tooltip key="fork" title="Fork 会话">
                  <Button type="text" size="small" icon={<BranchesOutlined />} onClick={(e) => { e.stopPropagation(); handleFork(s); }} />
                </Tooltip>,
                <Tooltip key="share" title="复制分享链接">
                  <Button type="text" size="small" icon={<LinkOutlined />} onClick={(e) => { e.stopPropagation(); handleCopyUrl(s); }} />
                </Tooltip>,
                <Tooltip key="rename" title="重命名">
                  <Button type="text" size="small" icon={<MessageOutlined />} onClick={(e) => { e.stopPropagation(); setRenameTarget(s); setNewTitle(s.title); }} />
                </Tooltip>,
                <Popconfirm
                  key="del"
                  title="确认删除该会话？"
                  onConfirm={(e) => { e?.stopPropagation(); handleDelete(s); }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    {s.agent && <span>{s.agent.icon}</span>}
                    <span style={{
                      fontSize: 12,
                      maxWidth: 160,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.title}</span>
                    {s.id === currentSessionId && <Tag color="blue" style={{ fontSize: 10 }}>当前</Tag>}
                  </Space>
                }
                description={
                  <span style={{ fontSize: 10, color: token.colorTextTertiary }}>
                    {new Date(s.updatedAt).toLocaleString('zh-CN')}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <>
      <Dropdown
        popupRender={() => panel}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        placement="bottomRight"
      >
        <Tooltip title="会话历史">
          <Button
            type="text"
            size={size}
            icon={<HistoryOutlined />}
            aria-label="会话历史"
          />
        </Tooltip>
      </Dropdown>
      <Modal
        title="重命名会话"
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={handleRename}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          maxLength={100}
          placeholder="会话标题"
          autoFocus
        />
      </Modal>
    </>
  );
}
