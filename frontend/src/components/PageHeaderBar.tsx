/**
 * 通用页面头部条 (V1.46.2)
 *
 * 替代每个 CRUD 列表页顶部重复的：
 *   <Card size="small"><Space>图标 + 标题 + 描述 + 操作按钮</Space></Card>
 *
 * @example
 *   <PageHeaderBar
 *     icon={<PartitionOutlined />}
 *     title="节点流管理"
 *     description="为每类工作项定义生命周期与流转规则"
 *     extra={<Button type="primary" onClick={handleCreate}>新建</Button>}
 *   />
 */
import { Card, Space, Tag } from 'antd';
import type { ReactNode } from 'react';

export interface PageHeaderBarProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tag?: { text: ReactNode; color?: string };
  extra?: ReactNode;
  marginBottom?: number;
  /** 默认 small；可传 default 取消紧凑模式 */
  size?: 'small' | 'default';
}

export function PageHeaderBar({
  icon,
  title,
  description,
  tag,
  extra,
  marginBottom = 12,
  size = 'small',
}: PageHeaderBarProps) {
  return (
    <Card size={size} style={{ marginBottom, borderRadius: 8 }} styles={{ body: { padding: 12 } }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          {icon && <span style={{ fontSize: 16, fontWeight: 500 }}>{icon} {title}</span>}
          {!icon && <span style={{ fontSize: 16, fontWeight: 500 }}>{title}</span>}
          {description && <span style={{ color: '#999' }}>{description}</span>}
          {tag && <Tag color={tag.color}>{tag.text}</Tag>}
        </Space>
        {extra && <Space>{extra}</Space>}
      </Space>
    </Card>
  );
}
