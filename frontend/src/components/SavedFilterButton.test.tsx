// V1.53: SavedFilterButton 通用筛选按钮组件测试
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedFilterButton } from './SavedFilterButton';

const mockFilters = [
  { id: '1', name: '我的筛选', filters: { q: 'test', status: 'active' }, source: 'local' as const, shared: false, createdAt: '2025-01-01T00:00:00Z' },
  { id: '2', name: '团队筛选', filters: { q: '', status: 'done' }, source: 'cloud' as const, shared: true, ownerId: 'u1', ownerName: '张三', createdAt: '2025-01-02T00:00:00Z' },
];

describe('SavedFilterButton', () => {
  it('renders button with label', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={vi.fn()}
        savedFilters={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('我的筛选')).toBeTruthy();
  });

  it('renders custom label', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={vi.fn()}
        savedFilters={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        label="已保存"
      />,
    );
    expect(screen.getByText('已保存')).toBeTruthy();
  });

  it('shows saved filter count badge', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={vi.fn()}
        savedFilters={mockFilters}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('opens popover on click', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: 'test' }}
        applyFilters={vi.fn()}
        savedFilters={mockFilters}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('我的筛选'));
    expect(screen.getByPlaceholderText('筛选名称')).toBeTruthy();
  });

  it('shows saved filters in popover', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={vi.fn()}
        savedFilters={mockFilters}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('我的筛选'));
    // 按钮和列表项中都有"我的筛选"，用 getAllByText
    const items = screen.getAllByText('我的筛选');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('团队筛选')).toBeTruthy();
  });

  it('shows cloud error when provided', () => {
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={vi.fn()}
        savedFilters={[]}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        cloudError="网络连接失败"
      />,
    );
    fireEvent.click(screen.getByText('我的筛选'));
    expect(screen.getByText(/云端同步失败/)).toBeTruthy();
  });

  it('calls applyFilters when clicking a saved filter', () => {
    const applyFilters = vi.fn();
    render(
      <SavedFilterButton
        currentFilters={{ q: '' }}
        applyFilters={applyFilters}
        savedFilters={mockFilters}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('我的筛选'));
    fireEvent.click(screen.getByText('团队筛选'));
    expect(applyFilters).toHaveBeenCalledWith({ q: '', status: 'done' });
  });
});