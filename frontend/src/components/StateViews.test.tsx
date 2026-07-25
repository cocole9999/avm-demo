// V1.53: StateViews 空/加载/错误/禁止状态组件测试
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, LoadingState, ErrorState, ForbiddenState } from './StateViews';

describe('EmptyState', () => {
  it('renders default description', () => {
    render(<EmptyState />);
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  it('renders custom description', () => {
    render(<EmptyState description="暂无客户" />);
    expect(screen.getByText('暂无客户')).toBeTruthy();
  });

  it('renders action button', () => {
    render(<EmptyState description="暂无" action={<button>创建</button>} />);
    expect(screen.getByText('创建')).toBeTruthy();
  });
});

describe('LoadingState', () => {
  it('renders with default tip', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.ant-spin')).toBeTruthy();
  });

  it('renders with custom tip', () => {
    render(<LoadingState tip="正在加载客户..." />);
    // antd 嵌套 Spin 的 tip 渲染在 .ant-spin-text 内
    const tip = document.querySelector('.ant-spin-text');
    expect(tip).toBeTruthy();
    expect(tip?.textContent).toContain('正在加载客户...');
  });

  it('respects minHeight', () => {
    const { container } = render(<LoadingState minHeight={400} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.minHeight).toBe('400px');
  });
});

describe('ErrorState', () => {
  it('renders error message from Error instance', () => {
    render(<ErrorState error={new Error('网络错误')} />);
    expect(screen.getByText('出错了')).toBeTruthy();
    expect(screen.getByText('网络错误')).toBeTruthy();
  });

  it('renders error message from string', () => {
    render(<ErrorState error="服务器错误" />);
    expect(screen.getByText('服务器错误')).toBeTruthy();
  });

  it('renders custom description', () => {
    render(<ErrorState description="自定义错误信息" />);
    expect(screen.getByText('自定义错误信息')).toBeTruthy();
  });

  it('renders retry button and handles click', () => {
    const onRetry = vi.fn();
    render(<ErrorState error="出错了" onRetry={onRetry} />);
    // antd 中文按钮文字间有空格（"重 试"）
    const btn = screen.getByRole('button', { name: /重\s*试/ });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState error="出错了" />);
    expect(screen.queryByRole('button', { name: /重\s*试/ })).toBeNull();
  });
});

describe('ForbiddenState', () => {
  it('renders default title and description', () => {
    render(<ForbiddenState />);
    expect(screen.getByText('权限不足')).toBeTruthy();
    expect(screen.getByText('该页面仅限管理员访问')).toBeTruthy();
  });

  it('renders custom title and description', () => {
    render(<ForbiddenState title="无权限" description="请联系管理员开通" />);
    expect(screen.getByText('无权限')).toBeTruthy();
    expect(screen.getByText('请联系管理员开通')).toBeTruthy();
  });
});