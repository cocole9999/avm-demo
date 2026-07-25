/**
 * V1.48 统一分页配置
 *
 * 用法：
 *   import { DEFAULT_PAGINATION } from '../constants/pagination';
 *   <Table pagination={{ ...DEFAULT_PAGINATION, total, current: page, onChange: setPage }} />
 */
import type { TablePaginationConfig } from 'antd';

export const DEFAULT_PAGINATION: Partial<TablePaginationConfig> = {
  pageSize: 20,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50', '100'],
};
