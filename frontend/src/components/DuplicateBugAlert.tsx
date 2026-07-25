/**
 * V1.50: AI 重复 Bug 检测结果展示
 *
 * 在新建 Bug 的 Modal 中显示。基于 title+description 调用 aiApi.checkDuplicateBug。
 * 显示相似 Bug 列表（key、标题、相似度、状态、负责人），可点击跳转或"查看详情"。
 */
import { Tag, Alert, List, Space, Spin, Button, Typography, Progress, Empty } from 'antd';
import { LinkOutlined, BugOutlined, FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { aiApi } from '../api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const { Text } = Typography;

interface Props {
  /** 当前编辑的 title（来自父组件 Form） */
  title: string;
  /** 当前编辑的 description */
  description?: string;
  /** 当前项目 ID（可选，限定搜索范围） */
  projectId?: string;
  /** 是否启用检测（通常是 type === 'bug'） */
  enabled: boolean;
}

export function DuplicateBugAlert({ title, description = '', projectId, enabled }: Props) {
  const navigate = useNavigate();
  const debouncedTitle = useDebouncedValue(title, 800);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    scannedCount: number;
    threshold: number;
    duplicateCount: number;
    duplicates: any[];
  } | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setChecked(null);
      return;
    }
    const t = debouncedTitle.trim();
    if (t.length < 4) {
      setResult(null);
      setChecked(null);
      return;
    }
    if (t === checked) return;

    const myReq = ++reqIdRef.current;
    setLoading(true);
    aiApi.checkDuplicateBug({ title: t, description, projectId, threshold: 0.35 })
      .then(r => {
        if (myReq !== reqIdRef.current) return; // 已过期
        setResult({
          scannedCount: r.scannedCount,
          threshold: r.threshold,
          duplicateCount: r.duplicateCount,
          duplicates: r.duplicates,
        });
        setChecked(t);
      })
      .catch(() => {
        if (myReq !== reqIdRef.current) return;
        setResult(null);
      })
      .finally(() => {
        if (myReq === reqIdRef.current) setLoading(false);
      });
  }, [debouncedTitle, description, projectId, enabled, checked]);

  if (!enabled) return null;

  if (loading) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<Spin size="small" />}
        message={<span style={{ fontSize: 12 }}>AI 正在检测相似 Bug...</span>}
        style={{ marginBottom: 12 }}
      />
    );
  }

  if (!result) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<BugOutlined />}
        message={<span style={{ fontSize: 12 }}>输入标题后，AI 会自动检测 90 天内是否存在相似 Bug</span>}
        style={{ marginBottom: 12 }}
      />
    );
  }

  if (result.duplicateCount === 0) {
    return (
      <Alert
        type="success"
        showIcon
        message={
          <span style={{ fontSize: 12 }}>
            ✅ 未发现相似 Bug（扫描 {result.scannedCount} 条 90 天内记录）
          </span>
        }
        style={{ marginBottom: 12 }}
      />
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      icon={<FireOutlined />}
      message={
        <span style={{ fontSize: 13 }}>
          ⚠️ 发现 {result.duplicateCount} 个相似 Bug，建议先确认是否重复
        </span>
      }
      description={
        <List
          size="small"
          style={{ marginTop: 4 }}
          dataSource={result.duplicates}
          renderItem={(d: any) => (
            <List.Item
              style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}
              actions={[
                <Button
                  key="view"
                  type="link"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => navigate(`/work-items/bug/${d.id}`)}
                >
                  查看
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4} wrap>
                    <Tag color="orange" style={{ margin: 0 }}>{d.key}</Tag>
                    <Text style={{ fontSize: 12 }}>{d.title}</Text>
                    <Tag color={d.status === '已关闭' || d.status === '已驳回' ? 'default' : 'red'} style={{ margin: 0, fontSize: 10 }}>
                      {d.status}
                    </Tag>
                  </Space>
                }
                description={
                  <Space size={6} wrap>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {d.priority} · {d.assignee || '未指派'}
                    </Text>
                    <Progress
                      percent={Math.round(d.similarity * 100)}
                      size="small"
                      style={{ width: 80, margin: 0 }}
                      strokeColor={d.similarity > 0.6 ? '#ff4d4f' : d.similarity > 0.4 ? '#faad14' : '#52c41a'}
                    />
                    <Text type="secondary" style={{ fontSize: 10 }}>{d.reason}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      }
      style={{ marginBottom: 12 }}
    />
  );
}
