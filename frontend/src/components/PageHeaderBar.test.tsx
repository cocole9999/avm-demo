// V1.53: PageHeaderBar 通用页面头部条组件测试
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeaderBar } from './PageHeaderBar';

describe('PageHeaderBar', () => {
  it('renders title', () => {
    render(<PageHeaderBar title="节点流管理" />);
    expect(screen.getByText('节点流管理')).toBeTruthy();
  });

  it('renders icon and title', () => {
    render(<PageHeaderBar icon={<span data-testid="icon">I</span>} title="节点流管理" />);
    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(screen.getByText('节点流管理')).toBeTruthy();
  });

  it('renders description', () => {
    render(<PageHeaderBar title="节点流管理" description="为每类工作项定义生命周期" />);
    expect(screen.getByText('为每类工作项定义生命周期')).toBeTruthy();
  });

  it('renders tag', () => {
    render(<PageHeaderBar title="企业管理" tag={{ text: 'V1.6', color: 'gold' }} />);
    expect(screen.getByText('V1.6')).toBeTruthy();
  });

  it('renders extra content', () => {
    render(<PageHeaderBar title="管理" extra={<button data-testid="create-btn">新建</button>} />);
    expect(screen.getByTestId('create-btn')).toBeTruthy();
  });

  it('renders without icon when not provided', () => {
    render(<PageHeaderBar title="管理" />);
    expect(screen.getByText('管理')).toBeTruthy();
  });
});