/**
 * V1.50 我的关注页 — 列出当前用户关注的所有工作项
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, List, Tag, Empty, Spin, Space, Button, Tooltip, App } from 'antd';
import { StarFilled, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { watchApi } from '../api';
import { PRIORITY_COLOR, STATUS_COLOR, TYPE_COLOR, TYPE_LABEL } from '../types';
import { PageHeaderBar } from '../components/PageHeaderBar';
import { useAuth } from '../AuthContext';
import { notifyApiError } from '../utils/apiError';

interface WatchingItem {
  id: string;
  workItemId: string;
  userId: string;
  userName: string;
  createdAt: string;
  workItem?: {
    id: string; key: string; title: string; type: string; status: string; priority: string; updatedAt: string;
  };
}

export function WatchingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unwatching, setUnwatching] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await watchApi.myWatching();
      setItems(list);
    } catch (e) {
      notifyApiError(e, '加载失败：');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUnwatch = async (workItemId: string) => {
    setUnwatching(workItemId);
    try {
      await watchApi.unwatch(workItemId);
      setItems(items.filter(i => i.workItemId !== workItemId));
      message.success('已取消关注');
    } catch (e) {
      notifyApiError(e, '取消关注失败：');
    } finally {
      setUnwatching(null);
    }
  };

  // V1.50: 计算超期（基于 planEnd）
  const isOverdue = (item: WatchingItem['workItem']): boolean => {
    if (!item) return false;
    // 简化为：状态非完成 + 优先级 >= P1 即视为可能延期
    return ['P0', 'P1'].includes(item.priority) && !['已关闭', '已驳回', '已完成', '已发布', '已验收'].includes(item.status);
  };

  return (
    <div>
      <PageHeaderBar
        title="我的关注"
        description={`关注的 ${items.length} 个工作项，状态/评论变更时会自动通知${user?.displayName || ''}`}
        extra={
          <Space>
            <Tag color="blue">V1.50</Tag>
          </Space>
        }
      />
      <Card>
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <p>暂无关注的工作项</p>
                  <p style={{ color: '#999', fontSize: 12 }}>打开任意工作项详情页，点击右上角"关注"按钮即可添加</p>
                </div>
              }
            />
          ) : (
            <List
              dataSource={items}
              renderItem={(item: WatchingItem) => {
                const wi = item.workItem;
                if (!wi) return null;
                return (
                  <List.Item
                    key={item.id}
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        onClick={() => navigate(`/work-items/${wi.type}/${wi.id}`)}
                      >
                        查看
                      </Button>,
                      <Button
                        key="unwatch"
                        type="link"
                        size="small"
                        danger
                        icon={<StarFilled />}
                        loading={unwatching === wi.id}
                        onClick={() => handleUnwatch(wi.id)}
                      >
                        取消关注
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={TYPE_COLOR[wi.type as keyof typeof TYPE_COLOR] || 'default'}>
                            {TYPE_LABEL[wi.type as keyof typeof TYPE_LABEL] || wi.type}
                          </Tag>
                          <Tag color={PRIORITY_COLOR[wi.priority]}>{wi.priority}</Tag>
                          <Tag color={STATUS_COLOR[wi.status as keyof typeof STATUS_COLOR] || 'default'}>
                            {wi.status}
                          </Tag>
                          {isOverdue(wi) && <Tag color="red" icon={<FireOutlined />}>高优先级</Tag>}
                          <Link to={`/work-items/${wi.type}/${wi.id}`} style={{ fontWeight: 500 }}>
                            {wi.key} {wi.title}
                          </Link>
                        </Space>
                      }
                      description={
                        <Space size={12} style={{ fontSize: 12 }}>
                          <Tooltip title="关注时间">
                            <span><ClockCircleOutlined /> 关注于 {dayjs(item.createdAt).format('MM-DD HH:mm')}</span>
                          </Tooltip>
                          <Tooltip title="工作项最近更新">
                            <span>· 最后更新 {dayjs(wi.updatedAt).format('MM-DD HH:mm')}</span>
                          </Tooltip>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
