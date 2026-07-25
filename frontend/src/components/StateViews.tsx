/**
 * 空/加载/错误三态视图 (V1.46.2)
 *
 * 替代散落在各页面的：
 *   {loading ? <Spin /> : list.length === 0 ? <Empty description="暂无数据" /> : <List />}
 *   {error && <Alert error />}
 *
 * @example
 *   if (loading) return <LoadingState />;
 *   if (error) return <ErrorState error={error} onRetry={reload} />;
 *   if (!list.length) return <EmptyState description="暂无客户" />;
 */
import { Empty, Spin, Alert, Button, Card } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  description?: ReactNode;
  image?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ description = '暂无数据', image, action }: EmptyStateProps) {
  return <Empty image={image ?? undefined} description={description} style={{ padding: 40 }}>
    {action}
  </Empty>;
}

export interface LoadingStateProps {
  tip?: string;
  size?: 'small' | 'default' | 'large';
  minHeight?: number;
}

export function LoadingState({ tip = '加载中...', size = 'default', minHeight = 200 }: LoadingStateProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight }}>
      <Spin tip={tip} size={size}>
        {/* antd Spin tip 仅在嵌套模式下生效，需要一个非空 children */}
        <div style={{ padding: 40 }} />
      </Spin>
    </div>
  );
}

export interface ErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  description?: ReactNode;
}

export function ErrorState({ error, onRetry, description }: ErrorStateProps) {
  const msg = description ?? (error instanceof Error ? error.message : typeof error === 'string' ? error : '加载失败');
  return (
    <Card>
      <Alert
        type="error"
        message="出错了"
        description={msg}
        showIcon
        action={onRetry && <Button size="small" onClick={onRetry}>重试</Button>}
      />
    </Card>
  );
}

/** 管理员访问限制提示（用于 AdminOnly 组件的 fallback） */
export interface ForbiddenStateProps {
  title?: string;
  description?: ReactNode;
}

export function ForbiddenState({
  title = '权限不足',
  description = '该页面仅限管理员访问',
}: ForbiddenStateProps) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: 60 }}>
        <LockOutlined style={{ fontSize: 48, color: '#ccc' }} />
        <div style={{ marginTop: 16, fontSize: 16, color: '#999' }}>{title}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#bbb' }}>{description}</div>
      </div>
    </Card>
  );
}
