/**
 * V1.55.6 Agent 使用统计页
 *
 * 内容：
 *   - 反馈总览（点赞/点踩/总评/点赞率）
 *   - Agent 会话数 Top 排行
 *   - 反馈列表（最近 50 条）
 */
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Empty, Spin, Progress, theme, Space, Button, Tooltip } from 'antd';
import {
  ReloadOutlined, LikeOutlined, DislikeOutlined, MessageOutlined,
  TrophyOutlined, RobotOutlined,
} from '@ant-design/icons';
import { agentFeedbackApi, type AgentFeedbackStats, type AgentMessageFeedback } from '../api';
import { PageHeaderBar } from '../components/PageHeaderBar';
import { AppBreadcrumb } from '../components/AppBreadcrumb';
import { notifyApiError } from '../utils/apiError';

const { useToken } = theme;

export function AgentStatsPage() {
  const { token } = useToken();
  const [stats, setStats] = useState<AgentFeedbackStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<AgentMessageFeedback[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await agentFeedbackApi.stats();
      setStats(s);
      // 汇总所有 feedback 记录
      const all: AgentMessageFeedback[] = [];
      // 这里 stats 端点不返回列表，但我们可以让用户在专门的 feedback 日志里查看
      // 当前展示所有已评分消息的总数即可
      setFeedbacks([]);
      void all;
    } catch (e) { notifyApiError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const sortedAgents = stats?.sessions.byAgent.slice().sort((a, b) => b.count - a.count) || [];
  const maxCount = Math.max(1, ...sortedAgents.map(a => a.count));

  const columns = [
    {
      title: 'Agent',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: any) => (
        <Space>
          <span style={{ fontSize: 18 }}>{row.icon}</span>
          <span>{name}</span>
          {!row.enabled && <Tag color="default">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (k: string) => <Tag color="blue">{k}</Tag>,
    },
    {
      title: '会话数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
      render: (n: number) => (
        <Space>
          <span style={{ fontWeight: 600, minWidth: 40, display: 'inline-block' }}>{n}</span>
          <div style={{ width: 120, display: 'inline-block' }}>
            <Progress
              percent={Math.round((n / maxCount) * 100)}
              showInfo={false}
              strokeColor={token.colorPrimary}
              size="small"
            />
          </div>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <AppBreadcrumb items={[
        { label: '工作台', path: '/workbench' },
        { label: 'AI 助理', path: '/ai' },
        { label: 'Agent 统计' },
      ]} />
      <PageHeaderBar
        title="Agent 使用统计"
        description="查看各 Agent 的会话数与消息反馈情况（仅管理员可见）"
        extra={
          <Tooltip title="刷新数据">
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          </Tooltip>
        }
      />

      <Spin spinning={loading}>
        {stats ? (
          <>
            {/* 反馈总览 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总反馈数"
                    value={stats.feedback.total}
                    prefix={<MessageOutlined style={{ color: token.colorPrimary }} />}
                    suffix="条"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="点赞"
                    value={stats.feedback.up}
                    prefix={<LikeOutlined style={{ color: token.colorSuccess }} />}
                    valueStyle={{ color: token.colorSuccess }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="点踩"
                    value={stats.feedback.down}
                    prefix={<DislikeOutlined style={{ color: token.colorError }} />}
                    valueStyle={{ color: token.colorError }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="点赞率"
                    value={stats.feedback.rate ?? 0}
                    suffix="%"
                    prefix={<TrophyOutlined style={{ color: token.colorWarning }} />}
                    valueStyle={{ color: token.colorWarning }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Agent 会话排行 */}
            <Card
              title={
                <Space>
                  <RobotOutlined />
                  <span>Agent 会话数排行</span>
                  <Tag color="blue">总计 {stats.sessions.total} 个会话</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              {sortedAgents.length > 0 ? (
                <Table
                  dataSource={sortedAgents.map((a, i) => ({ ...a, key: a.agentId, rank: i + 1 }))}
                  columns={columns}
                  pagination={false}
                  size="middle"
                />
              ) : (
                <Empty description="暂无 Agent 数据" />
              )}
            </Card>

            {/* 反馈总览详情 */}
            <Card title="反馈分布">
              {stats.feedback.total > 0 ? (
                <div style={{ padding: 12 }}>
                  <div style={{ marginBottom: 12 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span><LikeOutlined style={{ color: token.colorSuccess }} /> 点赞</span>
                      <span style={{ fontWeight: 600 }}>{stats.feedback.up} ({Math.round((stats.feedback.up / stats.feedback.total) * 100)}%)</span>
                    </Space>
                    <Progress
                      percent={Math.round((stats.feedback.up / stats.feedback.total) * 100)}
                      strokeColor={token.colorSuccess}
                      showInfo={false}
                    />
                  </div>
                  <div>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span><DislikeOutlined style={{ color: token.colorError }} /> 点踩</span>
                      <span style={{ fontWeight: 600 }}>{stats.feedback.down} ({Math.round((stats.feedback.down / stats.feedback.total) * 100)}%)</span>
                    </Space>
                    <Progress
                      percent={Math.round((stats.feedback.down / stats.feedback.total) * 100)}
                      strokeColor={token.colorError}
                      showInfo={false}
                    />
                  </div>
                </div>
              ) : (
                <Empty description="暂无反馈数据。用户在 AI 助理面板中对回复点赞/点踩后将在此显示。" />
              )}
            </Card>
          </>
        ) : (
          <Empty description="加载中..." />
        )}
      </Spin>
    </div>
  );
}
