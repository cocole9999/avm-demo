// V1.53: FilterBar 通用过滤栏组件测试
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders children', () => {
    render(<FilterBar><input placeholder="搜索..." data-testid="search" /></FilterBar>);
    expect(screen.getByTestId('search')).toBeTruthy();
  });

  it('renders reload button', () => {
    render(<FilterBar onReload={vi.fn()} />);
    expect(screen.getByText('刷新')).toBeTruthy();
  });

  it('calls onReload when refresh button clicked', () => {
    const onReload = vi.fn();
    render(<FilterBar onReload={onReload} />);
    fireEvent.click(screen.getByText('刷新'));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders create button when onCreate provided', () => {
    render(<FilterBar onCreate={vi.fn()} createText="新建客户" />);
    expect(screen.getByText('新建客户')).toBeTruthy();
  });

  it('calls onCreate when create button clicked', () => {
    const onCreate = vi.fn();
    render(<FilterBar onCreate={onCreate} createText="新建" />);
    fireEvent.click(screen.getByText('新建'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders default create text', () => {
    render(<FilterBar onCreate={vi.fn()} />);
    expect(screen.getByText('新建')).toBeTruthy();
  });

  it('renders export button when onExport provided', () => {
    render(<FilterBar onExport={vi.fn()} />);
    expect(screen.getByText('导出')).toBeTruthy();
  });

  it('hides export button when showExport is false', () => {
    render(<FilterBar onExport={vi.fn()} showExport={false} />);
    expect(screen.queryByText('导出')).toBeNull();
  });

  it('renders loading state on refresh button', () => {
    render(<FilterBar onReload={vi.fn()} loading={true} />);
    const btn = screen.getByText('刷新').closest('button');
    expect(btn?.classList.contains('ant-btn-loading')).toBeTruthy();
  });
});