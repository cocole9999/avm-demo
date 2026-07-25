/**
 * 通用 CRUD Drawer / Modal (V1.46.2)
 *
 * 替代每个 CRUD 页面重复的：
 *   <Drawer title=... open=... extra={[AI帮我填, 取消, 保存]}>{Form...}</Drawer>
 * 或 <Modal footer={[AI帮我填, 取消, 保存]}>{Form...}</Modal>
 *
 * 通过 useModal 切换形态，footer 统一渲染。
 *
 * @example
 *   <CrudDrawer
 *     open={drawerOpen}
 *     editing={editing}
 *     title="客户"
 *     onClose={closeDrawer}
 *     onSubmit={handleSubmit}
 *     onAiFill={handleAiFill}
 *     aiFilling={aiFilling}
 *     width={720}
 *   >
 *     <Form form={form} layout="vertical">...</Form>
 *   </CrudDrawer>
 */
import { Drawer, Modal, Space, Button, Tooltip } from 'antd';
import { ThunderboltOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface CrudDrawerProps {
  open: boolean;
  editing?: any | null;
  /** 标题文案；若为函数则根据 editing 动态生成 */
  title: string | ((editing: any | null) => string);
  width?: number;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  /** 传入则渲染「AI 帮我填」按钮 */
  onAiFill?: () => void;
  aiFilling?: boolean;
  /** 渲染 Modal 而非 Drawer（默认 Drawer） */
  useModal?: boolean;
  /** Drawer forceRender（默认 true，保证 Form 提前挂载） */
  forceRender?: boolean;
  extraFooter?: ReactNode;
  /** V1.53: 表单撤销/重做 */
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  children: ReactNode;
}

export function CrudDrawer({
  open,
  editing,
  title,
  width = 720,
  onClose,
  onSubmit,
  submitting,
  onAiFill,
  aiFilling,
  useModal = false,
  forceRender = true,
  extraFooter,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: CrudDrawerProps) {
  const resolvedTitle = typeof title === 'function' ? title(editing) : title;
  const footer = (
    <Space>
      {/* V1.53: 表单撤销/重做（仅编辑模式显示） */}
      {editing && onUndo && (
        <Tooltip title="撤销 (Ctrl+Z)">
          <Button icon={<UndoOutlined />} onClick={onUndo} disabled={!canUndo} />
        </Tooltip>
      )}
      {editing && onRedo && (
        <Tooltip title="重做 (Ctrl+Y)">
          <Button icon={<RedoOutlined />} onClick={onRedo} disabled={!canRedo} />
        </Tooltip>
      )}
      {onAiFill && (
        <Button icon={<ThunderboltOutlined />} onClick={onAiFill} loading={aiFilling}>
          AI 帮我填
        </Button>
      )}
      {extraFooter}
      <Button onClick={onClose}>取消</Button>
      <Button type="primary" onClick={onSubmit} loading={submitting}>
        保存
      </Button>
    </Space>
  );

  if (useModal) {
    return (
      <Modal
        title={resolvedTitle}
        open={open}
        onCancel={onClose}
        onOk={onSubmit}
        okText="保存"
        cancelText="取消"
        width={width}
        forceRender={forceRender}
        footer={footer}
      >
        {children}
      </Modal>
    );
  }

  return (
    <Drawer
      title={resolvedTitle}
      open={open}
      onClose={onClose}
      width={width}
      forceRender={forceRender}
      extra={footer}
    >
      {children}
    </Drawer>
  );
}
