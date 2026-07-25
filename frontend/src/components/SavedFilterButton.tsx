/**
 * V1.52 通用"我的筛选"按钮 + Popover 面板
 *
 * 用法：
 *   const { savedFilters, ... } = useSavedFilters(resourceKey, currentFilters, { cloudSync: true });
 *   <SavedFilterButton
 *     currentFilters={currentFilters}
 *     applyFilters={(f) => { setQ(f.q || ''); setStatus(f.status); ... }}
 *     savedFilters={savedFilters}
 *     onSave={(name, shared) => saveFilter(name, shared)}
 *     onDelete={(id) => deleteFilter(id)}
 *     onShare={(id, shared) => shareFilter(id, shared)}
 *     cloudError={cloudError}
 *   />
 *
 * 抽取自 WorkItemsPage 的 V1.52 完整实现，复用到其他 7 个 CRUD 页
 */
import { useState } from 'react';
import { Button, Popover, Input, Checkbox, Tag, Tooltip, Popconfirm, Space, message } from 'antd';
import {
  StarOutlined, StarFilled, SaveOutlined, LockOutlined, UnlockOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { SavedFilter } from '../hooks/useSavedFilters';

export interface SavedFilterButtonProps<T extends Record<string, any>> {
  currentFilters: T;
  /** 应用筛选：把已保存的 filter 对象 setState 到当前页面的筛选 state */
  applyFilters: (filters: T) => void;
  /** 已保存的筛选列表（来自 useSavedFilters） */
  savedFilters: SavedFilter<T>[];
  /** 保存：name + shared（true = 团队共享） */
  onSave: (name: string, shared: boolean) => SavedFilter<T> | null;
  /** 删除 */
  onDelete: (id: string) => void;
  /** 切换团队共享（仅云端项可调用） */
  onShare?: (id: string, shared: boolean) => void;
  /** 云端同步错误提示 */
  cloudError?: string | null;
  /** 按钮文案（默认 "我的筛选"） */
  label?: string;
}

export function SavedFilterButton<T extends Record<string, any>>(props: SavedFilterButtonProps<T>) {
  const {
    currentFilters, applyFilters, savedFilters,
    onSave, onDelete, onShare, cloudError,
    label = '我的筛选',
  } = props;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const handleSave = (v?: string) => {
    const finalName = (v ?? name).trim();
    if (!finalName) {
      message.warning('请输入筛选名称');
      return;
    }
    const r = onSave(finalName, shared);
    if (r) {
      message.success(shared ? `已保存并共享: ${finalName}` : `已保存筛选: ${finalName}`);
      setName('');
      setShared(false);
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      destroyOnHidden
      content={
        <div style={{ width: 300 }}>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 500 }}>💾 保存当前筛选</div>
          <Input.Search
            placeholder="筛选名称"
            enterButton={<SaveOutlined />}
            value={name}
            onChange={e => setName(e.target.value)}
            onSearch={(v) => handleSave(v)}
          />
          {onShare && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>
              <Checkbox checked={shared} onChange={e => setShared(e.target.checked)}>
                团队共享（云端持久化，跨设备可见）
              </Checkbox>
            </div>
          )}
          {cloudError && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#ff4d4f' }}>
              ⚠️ 云端同步失败：{cloudError}
            </div>
          )}
          {savedFilters.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
                📋 已保存的筛选（{savedFilters.length}）
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {savedFilters.map(f => {
                  const filterCount = Object.values(f.filters).filter(v => v !== '' && v != null).length;
                  const isShared = f.source === 'cloud-shared';
                  return (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                        borderBottom: '1px dashed #f0f0f0',
                        background: isShared ? '#f0f5ff' : 'transparent',
                      }}
                      onClick={() => {
                        applyFilters(f.filters);
                        setOpen(false);
                        message.success(`已应用筛选: ${f.name}（${filterCount} 个条件）`);
                      }}
                    >
                      <Space size={4} wrap style={{ flex: 1, minWidth: 0 }}>
                        <StarFilled style={{ color: isShared ? '#1677ff' : '#faad14' }} />
                        <span style={{
                          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: 140,
                        }}>{f.name}</span>
                        <Tag color="default" style={{ margin: 0, fontSize: 10 }}>{filterCount} 条件</Tag>
                        {isShared && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>团队</Tag>}
                        {f.ownerName && f.source === 'cloud' && !isShared && (
                          <span style={{ fontSize: 10, color: '#999' }}>· {f.ownerName}</span>
                        )}
                      </Space>
                      <Space size={2}>
                        {onShare && f.source === 'cloud' && f.ownerId && (
                          <Tooltip title={f.shared ? '取消团队共享' : '开启团队共享'}>
                            <Button
                              size="small" type="text"
                              icon={f.shared ? <UnlockOutlined /> : <LockOutlined />}
                              onClick={(e) => { e.stopPropagation(); onShare(f.id, !f.shared); }}
                              style={{ color: f.shared ? '#1677ff' : '#999' }}
                            />
                          </Tooltip>
                        )}
                        <Popconfirm
                          title="确认删除此筛选？"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            onDelete(f.id);
                            message.success('已删除');
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                        >
                          <Button
                            size="small" type="text" danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      }
    >
      <Button icon={<StarOutlined />}>
        {label} {savedFilters.length > 0 && <Tag color="blue" style={{ marginLeft: 4 }}>{savedFilters.length}</Tag>}
      </Button>
    </Popover>
  );
}
