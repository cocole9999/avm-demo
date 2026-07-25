/**
 * 通用过滤栏 (V1.46.2)
 *
 * 替代每个 CRUD 列表页顶部重复的：
 *   <Card size="small"><Space wrap>搜索框 + Select + 刷新 + 导出 + 新建</Space></Card>
 *
 * 内置刷新/导出/新建按钮的统一样式，业务筛选项通过 children 传入。
 *
 * @example
 *   <FilterBar
 *     onReload={reload}
 *     loading={loading}
 *     onExport={handleExport}
 *     exportLoading={exporting}
 *     onCreate={openCreate}
 *     createText="新建客户"
 *   >
 *     <Input placeholder="搜索..." prefix={<SearchOutlined />} ... />
 *     <Select placeholder="状态" ... />
 *   </FilterBar>
 */
import { Card, Space, Button, Dropdown } from 'antd';
import { ReloadOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { ExportFormat } from '../hooks/useExport';

export interface FilterBarProps {
  children?: ReactNode;
  onReload?: () => void;
  loading?: boolean;
  onExport?: (format: ExportFormat) => void;
  exportLoading?: boolean;
  onCreate?: () => void;
  createText?: string;
  extra?: ReactNode;
  showExport?: boolean;
  marginBottom?: number;
}

export function FilterBar({
  children,
  onReload,
  loading,
  onExport,
  exportLoading,
  onCreate,
  createText = '新建',
  extra,
  showExport,
  marginBottom = 12,
}: FilterBarProps) {
  const showExportBtn = showExport ?? !!onExport;
  return (
    <Card size="small" style={{ marginBottom, borderRadius: 8 }}>
      <Space wrap>
        {children}
        {onReload && (
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading}>
            刷新
          </Button>
        )}
        {showExportBtn && onExport && (
          <Dropdown
            menu={{
              items: [
                { key: 'xlsx', label: '导出 Excel (.xlsx)', onClick: () => onExport('xlsx') },
                { key: 'csv', label: '导出 CSV (.csv)', onClick: () => onExport('csv') },
              ],
            }}
          >
            <Button icon={<DownloadOutlined />} loading={exportLoading}>
              导出
            </Button>
          </Dropdown>
        )}
        {onCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {createText}
          </Button>
        )}
        {extra}
      </Space>
    </Card>
  );
}
