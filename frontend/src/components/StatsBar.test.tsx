// V1.53: StatsBar 通用统计卡条组件测试
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from './StatsBar';

describe('StatsBar', () => {
  it('renders empty when items is empty', () => {
    const { container } = render(<StatsBar items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders single stat item', () => {
    render(<StatsBar items={[{ title: '客户总数', value: 42 }]} />);
    expect(screen.getByText('客户总数')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders multiple stat items', () => {
    render(<StatsBar items={[
      { title: '总数', value: 100 },
      { title: '活跃', value: 80 },
      { title: '停用', value: 20 },
    ]} />);
    expect(screen.getByText('总数')).toBeTruthy();
    expect(screen.getByText('活跃')).toBeTruthy();
    expect(screen.getByText('停用')).toBeTruthy();
  });

  it('renders prefix and suffix', () => {
    render(<StatsBar items={[
      { title: '金额', value: '1,234', prefix: '¥', suffix: '元' },
    ]} />);
    expect(screen.getByText('¥')).toBeTruthy();
    expect(screen.getByText('元')).toBeTruthy();
  });

  it('applies valueStyle to Statistic', () => {
    render(<StatsBar items={[
      { title: '风险', value: 5, valueStyle: { color: '#ff4d4f' } },
    ]} />);
    const statEl = screen.getByText('5').closest('.ant-statistic-content-value');
    expect(statEl).toBeTruthy();
  });

  it('calls onClick when provided', () => {
    const onClick = vi.fn();
    render(<StatsBar items={[{ title: '可点击', value: 10, onClick }]} />);
    const card = screen.getByText('可点击').closest('.ant-card');
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects custom span', () => {
    render(<StatsBar items={[
      { title: 'A', value: 1, span: 12 },
      { title: 'B', value: 2, span: 12 },
    ]} />);
    const cols = document.querySelectorAll('.ant-col');
    expect(cols.length).toBeGreaterThanOrEqual(2);
  });
});