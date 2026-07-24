/**
 * V1.28 燃尽图
 * - 双折线: 理想剩余 vs 实际剩余
 * - 数据: GET /api/iterations/:id/burndown
 */
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Select, Spin, Empty, Card, Space, Tag } from 'antd';
import { iterationApi, api } from '../api';
import { useWorkItemChanged } from '../services/useWorkItemChanged';

interface BurndownData {
  iteration: { id: string; name: string; startDate: string; endDate: string; totalEstimate: number };
  daily: Array<{ date: string; plannedRemaining: number; actualRemaining: number }>;
}

export function BurndownChart() {
  const [iterations, setIterations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    iterationApi.list().then((list: any[]) => {
      setIterations(list);
      const active = list.find((i: any) => i.status === 'active') || list[0];
      if (active) setSelected(active.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    // V1.30.3 P0-7: 用 api 实例 (自动注入 token), 不再手动读 localStorage
    api.get(`/iterations/${selected}/burndown`)
      .then(r => r.data)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected]);

  // V1.47: AI 修改/新增工作项后自动刷新燃尽图
  useWorkItemChanged(() => {
    if (!selected) return;
    api.get(`/iterations/${selected}/burndown`)
      .then(r => r.data)
      .then(d => setData(d))
      .catch(() => {});
  });

  const option = data ? {
    grid: { left: 50, right: 16, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    xAxis: { type: 'category', data: data.daily.map(d => d.date), axisLabel: { fontSize: 10, rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', name: '剩余工时', nameLocation: 'end', nameGap: 15, axisLabel: { fontSize: 10, hideOverlap: true } },
    series: [
      { name: '理想剩余', type: 'line', data: data.daily.map(d => d.plannedRemaining), smooth: true, itemStyle: { color: '#1677ff' }, lineStyle: { type: 'dashed' } },
      { name: '实际剩余', type: 'line', data: data.daily.map(d => d.actualRemaining), smooth: true, itemStyle: { color: '#52c41a' } },
    ],
  } : {};

  return (
    <Card size="small" title={
      <Space>
        <span>📉 燃尽图</span>
        <Select
          value={selected}
          onChange={setSelected}
          style={{ minWidth: 180 }}
          placeholder="选择迭代"
          size="small"
        >
          {iterations.map(i => (
            <Select.Option key={i.id} value={i.id}>
              {i.name} {i.status === 'active' && <Tag color="green">进行中</Tag>}
            </Select.Option>
          ))}
        </Select>
      </Space>
    }>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        : !data ? <Empty description="无数据" />
        : data.daily.length === 0 ? <Empty description="迭代内无工作项" />
        : <>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
              总估分: <b>{data.iteration.totalEstimate}h</b> · 周期: {data.iteration.startDate.slice(0, 10)} ~ {data.iteration.endDate.slice(0, 10)}
            </div>
            <ReactECharts option={option} style={{ height: 280 }} notMerge lazyUpdate />
          </>}
    </Card>
  );
}
