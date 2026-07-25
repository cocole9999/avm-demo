/**
 * V1.50: AI 评论摘要卡片
 *
 * 在工作项详情页评论 Tab 顶部展示。评论 >= 3 条时显示"AI 摘要"按钮。
 * 点击后调用 aiApi.summarizeComments, 展示关键决策/待解/行动项/情感倾向。
 */
import { useState } from 'react';
import { Card, Button, Space, Tag, Spin, Alert, Empty, Tooltip, Typography, Collapse, message, theme } from 'antd';
import {
  RobotOutlined, BulbOutlined, QuestionCircleOutlined, CheckCircleOutlined,
  ThunderboltOutlined, FrownOutlined, SmileOutlined, MehOutlined, FormatPainterOutlined,
} from '@ant-design/icons';
import { aiApi } from '../api';

const { Text } = Typography;

export interface CommentSummary {
  decisions: string[];
  openQuestions: string[];
  actionItems: Array<{ who: string | null; what: string; when: string | null }>;
  sentiment: 'positive' | 'neutral' | 'mixed' | 'negative';
  oneLiner: string;
}

interface Props {
  workItemId: string;
  commentCount: number;
}

const SENTIMENT_META: Record<string, { color: string; icon: JSX.Element; label: string }> = {
  positive: { color: 'green', icon: <SmileOutlined />, label: '正向' },
  neutral: { color: 'default', icon: <MehOutlined />, label: '中性' },
  mixed: { color: 'gold', icon: <MehOutlined />, label: '分歧' },
  negative: { color: 'red', icon: <FrownOutlined />, label: '负向' },
};

export function CommentSummaryCard({ workItemId, commentCount }: Props) {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<CommentSummary | null>(null);
  const [meta, setMeta] = useState<{ skipped: boolean; reason?: string; llmModel: string | null } | null>(null);
  const [expanded, setExpanded] = useState(true);

  if (commentCount < 3) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const r = await aiApi.summarizeComments(workItemId);
      if (r.summary) setSummary(r.summary as CommentSummary);
      setMeta({ skipped: r.skipped, reason: r.reason, llmModel: r.llmModel });
    } catch (e: any) {
      message.error('生成摘要失败：' + (e?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const sentiment = summary ? SENTIMENT_META[summary.sentiment] || SENTIMENT_META.neutral : null;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        background: token.colorBgLayout,
        borderColor: token.colorBorderSecondary,
      }}
      title={
        <Space size={8}>
          <RobotOutlined style={{ color: token.colorPrimary }} />
          <span>AI 评论摘要</span>
          {sentiment && (
            <Tag color={sentiment.color} icon={sentiment.icon}>{sentiment.label}</Tag>
          )}
          {summary?.oneLiner && (
            <Text type="secondary" style={{ fontSize: 12 }}>· {summary.oneLiner}</Text>
          )}
        </Space>
      }
      extra={
        <Space>
          {meta?.llmModel && (
            <Tooltip title={`模型: ${meta.llmModel}`}>
              <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{meta.llmModel}</Tag>
            </Tooltip>
          )}
          <Button
            type={summary ? 'default' : 'primary'}
            ghost={!summary}
            size="small"
            icon={loading ? <Spin size="small" /> : <FormatPainterOutlined />}
            onClick={handleGenerate}
            loading={loading}
          >
            {summary ? '重新生成' : `AI 摘要 (${commentCount} 条)`}
          </Button>
        </Space>
      }
    >
      {meta?.skipped && !summary && (
        <Alert type="info" showIcon message={meta.reason || '暂不需要 AI 摘要'} />
      )}
      {meta?.skipped && summary && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message={`已使用基础摘要（${meta.reason || '降级模式'}），效果可能不如 LLM 摘要`}
        />
      )}
      {summary && (
        <Collapse
          ghost
          activeKey={expanded ? ['1'] : []}
          onChange={(keys) => setExpanded(Array.isArray(keys) ? keys.includes('1') : !!keys)}
          items={[
            {
              key: '1',
              showArrow: false,
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {/* 关键决策 */}
                  <SummarySection
                    icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    title="关键决策"
                    empty="暂无可识别的决策"
                    items={summary.decisions}
                    color="green"
                  />
                  {/* 待解问题 */}
                  <SummarySection
                    icon={<QuestionCircleOutlined style={{ color: '#fa8c16' }} />}
                    title="待解问题"
                    empty="暂无待澄清问题"
                    items={summary.openQuestions}
                    color="orange"
                  />
                  {/* 行动项 */}
                  <div>
                    <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                      <ThunderboltOutlined style={{ color: '#1677ff', marginRight: 4 }} />
                      行动项 {summary.actionItems.length > 0 && <Tag color="blue">{summary.actionItems.length}</Tag>}
                    </div>
                    {summary.actionItems.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>暂无行动项</Text>
                    ) : (
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        {summary.actionItems.map((a, i) => (
                          <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12, border: '1px solid #f0f0f0' }}>
                            <Tag color="blue" style={{ marginRight: 4 }}>{a.who || '未指派'}</Tag>
                            <span>{a.what}</span>
                            {a.when && <Text type="secondary" style={{ marginLeft: 4 }}>· {a.when}</Text>}
                          </div>
                        ))}
                      </Space>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
      {!summary && !meta && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ fontSize: 12 }}>
              <BulbOutlined /> 基于 {commentCount} 条评论生成关键决策 / 待解 / 行动项
            </span>
          }
        />
      )}
    </Card>
  );
}

function SummarySection({
  icon, title, empty, items, color,
}: { icon: JSX.Element; title: string; empty: string; items: string[]; color: string }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
        {icon}
        <span style={{ marginLeft: 4 }}>{title}</span>
        {items.length > 0 && <Tag color={color} style={{ marginLeft: 4 }}>{items.length}</Tag>}
      </div>
      {items.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>{empty}</Text>
      ) : (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {items.map((t, i) => (
            <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12, border: '1px solid #f0f0f0' }}>
              {t}
            </div>
          ))}
        </Space>
      )}
    </div>
  );
}
