/**
 * 表格操作列辅助 (V1.46.2)
 *
 * 替代每个 CRUD 页面 columns 末尾重复的：
 *   { title: '操作', render: (_, r) => <Space><Button 编辑/><Popconfirm 删除/></Space> }
 *
 * @example
 *   const columns = [
 *     { title: '名称', dataIndex: 'name' },
 *     ...useActionColumns({ onEdit: handleEdit, onDelete: handleDelete }),
 *   ];
 */
import type { ReactNode } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Space, Button, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

export interface ActionColumnOptions<T = any> {
  onEdit?: (record: T) => void;
  onDelete?: (id: string, record: T) => void;
  deleteConfirmText?: string | ((r: T) => string);
  deleteConfirmDescription?: ReactNode;
  extraActions?: (r: T) => ReactNode;
  width?: number;
  fixed?: 'left' | 'right';
  /** 是否禁用编辑（基于 record 判断） */
  editDisabled?: (r: T) => boolean;
  /** 是否禁用删除 */
  deleteDisabled?: (r: T) => boolean;
}

export function buildActionColumns<T = any>(options: ActionColumnOptions<T>): ColumnsType<T> {
  const {
    onEdit,
    onDelete,
    deleteConfirmText = '确定删除？',
    deleteConfirmDescription,
    extraActions,
    width = 140,
    fixed = 'right',
    editDisabled,
    deleteDisabled,
  } = options;

  if (!onEdit && !onDelete && !extraActions) return [];

  return [
    {
      title: '操作',
      key: '__actions__',
      width,
      fixed,
      render: (_: any, record: T) => {
        const id = (record as any)?.id;
        const editDisabledFlag = editDisabled?.(record);
        const deleteDisabledFlag = deleteDisabled?.(record);
        return (
          <Space size="small">
            {onEdit && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
                disabled={editDisabledFlag}
              >
                编辑
              </Button>
            )}
            {onDelete && (
              <Popconfirm
                title={typeof deleteConfirmText === 'function' ? deleteConfirmText(record) : deleteConfirmText}
                description={deleteConfirmDescription}
                onConfirm={() => onDelete(id, record)}
                disabled={deleteDisabledFlag}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={deleteDisabledFlag}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
            {extraActions?.(record)}
          </Space>
        );
      },
    } as any,
  ];
}

/** Hook 形式（与组件风格保持一致，但本质是函数） */
export function useActionColumns<T = any>(options: ActionColumnOptions<T>): ColumnsType<T> {
  return buildActionColumns<T>(options);
}
