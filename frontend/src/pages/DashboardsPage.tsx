import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, message, Select } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined, FundProjectionScreenOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, chartApi } from '../api';
import type { Dashboard, ChartConfig } from '../types';
import { notifyApiError } from '../utils/apiError';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SavedFilterButton } from '../components/SavedFilterButton';

export function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  // V1.52: 关键词 + 范围筛选
  const [q, setQ] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const navigate = useNavigate();

  // V1.52: 已保存筛选
  const currentFilters = useMemo(() => ({ q, scope: scopeFilter || '' }), [q, scopeFilter]);
  const { savedFilters, saveFilter, deleteFilter, shareFilter, cloudError } =
    useSavedFilters('dashboard-list', currentFilters, { cloudSync: true });

  const filteredDashboards = useMemo(() => {
    let list = dashboards;
    if (scopeFilter) list = list.filter(d => d.scope === scopeFilter);
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter(d =>
        (d.name || '').toLowerCase().includes(k) ||
        (d.description || '').toLowerCase().includes(k),
      );
    }
    return list;
  }, [dashboards, q, scopeFilter]);

  const load = async () => {
    setLoading(true);
    try {
      setDashboards(await dashboardApi.list());
    } catch (e) {
      notifyApiError(e, '加载失败：');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const created = await dashboardApi.create({ ...values, layout: '[]' });
      message.success('仪表盘已创建');
      setModalOpen(false);
      form.resetFields();
      navigate(`/dashboards/${created.id}`);
    } catch (e) {
      notifyApiError(e, '创建失败：');
    }
  };

  const handleDelete = (d: Dashboard) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除「${d.name}」？关联图表会丢失关联但不会被删除`,
      okType: 'danger',
      onOk: async () => {
        await dashboardApi.delete(d.id);
        message.success('已删除');
        load();
      },
    });
  };

  return (
    <div>
      <Card style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}>
        <Space wrap>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            <FundProjectionScreenOutlined /> 度量仪表盘
          </span>
          <span style={{ color: '#999' }}>多维数据图表与自定义门户</span>
          <Input.Search
            placeholder="搜索名称/描述" allowClear
            style={{ width: 220 }}
            value={q} onChange={e => setQ(e.target.value)}
          />
          <Select
            placeholder="范围" allowClear
            value={scopeFilter} onChange={setScopeFilter}
            style={{ width: 110 }}
            options={[
              { value: 'system', label: '系统' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          {/* V1.52: 已保存筛选 + 团队共享 */}
          <SavedFilterButton
            currentFilters={currentFilters}
            applyFilters={(f) => {
              setQ(f.q || '');
              setScopeFilter(f.scope || undefined);
            }}
            savedFilters={savedFilters}
            onSave={(name, shared) => saveFilter(name, shared)}
            onDelete={(id) => deleteFilter(id)}
            onShare={(id, shared) => shareFilter(id, shared)}
            cloudError={cloudError}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建仪表盘
          </Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
        {filteredDashboards.map(d => (
          <Card
            key={d.id}
            hoverable
            title={<a onClick={() => navigate(`/dashboards/${d.id}`)}>{d.name}</a>}
            extra={<Tag color={d.scope === 'custom' ? 'blue' : 'purple'}>{d.scope === 'custom' ? '自定义' : '系统'}</Tag>}
            actions={[
              <EyeOutlined key="view" onClick={() => navigate(`/dashboards/${d.id}`)} />,
              <DeleteOutlined key="del" onClick={() => handleDelete(d)} />,
            ]}
          >
            <p style={{ color: '#666', minHeight: 44 }}>{d.description || '暂无描述'}</p>
            <div style={{ fontSize: 12, color: '#999' }}>
              <Tag>{d._count?.charts || 0} 个图表</Tag>
              <span>更新于 {new Date(d.updatedAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title="新建仪表盘"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="仪表盘名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="如：项目总览" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}