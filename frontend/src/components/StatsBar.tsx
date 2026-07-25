/**
 * 通用顶部统计卡条 (V1.46.2)
 *
 * 替代每个 CRUD 列表页顶部重复的：
 *   <Row gutter={12}><Col><Card size="small"><Statistic .../></Card></Col>...</Row>
 *
 * @example
 *   <StatsBar items={[
 *     { title: '客户总数', value: list.length, prefix: <BankOutlined /> },
 *     { title: '活跃客户', value: activeCount, valueStyle: { color: '#52c41a' } },
 *   ]} />
 */
import { Row, Col, Card, Statistic } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export interface StatItem {
  title: ReactNode;
  value: string | number;
  prefix?: ReactNode;
  suffix?: string;
  valueStyle?: CSSProperties;
  onClick?: () => void;
  /** 该项占用的栅格宽度（默认 24 / items.length，可单独覆盖） */
  span?: number;
}

export interface StatsBarProps {
  items: StatItem[];
  gutter?: number | [number, number];
  marginBottom?: number;
  /** 默认 24 / items.length 向下取整 */
  defaultSpan?: number;
}

export function StatsBar({
  items,
  gutter = 12,
  marginBottom = 12,
  defaultSpan,
}: StatsBarProps) {
  if (!items.length) return null;
  const autoSpan = defaultSpan ?? Math.floor(24 / items.length);
  return (
    <Row gutter={gutter} style={{ marginBottom }}>
      {items.map((it, i) => (
        <Col key={i} span={it.span ?? autoSpan}>
          <Card
            size="small"
            style={{ borderRadius: 8, cursor: it.onClick ? 'pointer' : 'default' }}
            onClick={it.onClick}
          >
            <Statistic
              title={it.title}
              value={it.value}
              prefix={it.prefix}
              suffix={it.suffix}
              valueStyle={it.valueStyle}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
