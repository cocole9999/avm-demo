import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message, Avatar } from 'antd';
import { PlusOutlined, AuditOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { reviewApi, workItemApi } from '../api';
import type { Review, ReviewTemplate } from '../types';
import { notifyApiError } from '../utils/apiError';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { SavedFilterButton } from '../components/SavedFilterButton';

const REVIEW_TYPE_LABEL: Record<string, string> = { tr: '技术评审 TR', dcp: '决策评审 DCP', qr: '质量评审 QR' };
const REVIEW_TYPE_COLOR: Record<string, string> = { tr: 'blue', dcp: 'purple', qr: 'cyan' };
const STATUS_COLOR: Record<string, string> = {
  pending: 'default', in_progress: 'processing', approved: 'success', rejected: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: '待评审', in_progress: '评审中', approved: '已通过', rejected: '已驳回',
};
const CONCLUSION_LABEL: Record<string, string> = { go: '通过', not_go: '驳回', go_with_risk: '有条件通过' };
const CONCLUSION_COLOR: Record<string, string> = { go: 'success', not_go: 'error', go_with_risk: 'warning' };

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  // V1.52: 关键词 + 类型 + 状态筛选
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const navigate = useNavigate();

  // V1.52: 已保存筛选
  const currentFilters = useMemo(() => ({
    q, type: typeFilter || '', status: statusFilter || '',
  }), [q, typeFilter, statusFilter]);
  const { savedFilters, saveFilter, deleteFilter, shareFilter, cloudError } =
    useSavedFilters('review-list', currentFilters, { cloudSync: true });

  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (typeFilter) list = list.filter(r => r.reviewType === typeFilter);
    if (statusFilter) list = list.filter(r => r.status === statusFilter);
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(k) ||
        (r.initiator || '').toLowerCase().includes(k) ||
        (r.workItem?.key || '').toLowerCase().includes(k),
      );
    }
    return list;
  }, [reviews, q, typeFilter, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, tpls] = await Promise.all([reviewApi.list(), reviewApi.listTemplates()]);
      setReviews(list);
      setTemplates(tpls);
    } catch (e: any) {
      message.error('加载失败：' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    workItemApi.list({}).then(setWorkItems);
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const tpl = templates.find(t => t.id === values.templateId);
      if (!tpl) {
        message.error('请选择评审模板');
        return;
      }
      const items = JSON.parse(tpl.items);
      const participants = (values.participants || []).map((u: any) => ({
        userId: u, userName: users.find(x => x.id === u)?.displayName || u, role: 'reviewer', weight: 1,
      }));
      const created = await reviewApi.create({
        workItemId: values.workItemId,
        reviewType: tpl.reviewType,
        title: values.title,
        initiator: '我',
        participants,
        items,
      });
      message.success('评审已发起');
      setModalOpen(false);
      form.resetFields();
      navigate(`/reviews/${created.id}`);
    } catch (e) {
      notifyApiError(e, '发起失败：');
    }
  };

  const applyTemplate = (tplId: string) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    form.setFieldsValue({ title: tpl.name, templateId: tplId });
  };

  return (
    <div>
      <Card style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}>
        <Space wrap>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            <AuditOutlined /> 评审中心
          </span>
          <span style={{ color: '#999' }}>TR/DCP/QR 评审管理与追踪</span>
          <Input.Search
            placeholder="搜索标题/工作项/发起人" allowClear
            style={{ width: 220 }}
            value={q} onChange={e => setQ(e.target.value)}
          />
          <Select
            placeholder="类型" allowClear
            value={typeFilter} onChange={setTypeFilter}
            style={{ width: 140 }}
            options={Object.entries(REVIEW_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select
            placeholder="状态" allowClear
            value={statusFilter} onChange={setStatusFilter}
            style={{ width: 110 }}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
          />
          {/* V1.52: 已保存筛选 + 团队共享 */}
          <SavedFilterButton
            currentFilters={currentFilters}
            applyFilters={(f) => {
              setQ(f.q || '');
              setTypeFilter(f.type || undefined);
              setStatusFilter(f.status || undefined);
            }}
            savedFilters={savedFilters}
            onSave={(name, shared) => saveFilter(name, shared)}
            onDelete={(id) => deleteFilter(id)}
            onShare={(id, shared) => shareFilter(id, shared)}
            cloudError={cloudError}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            发起评审
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={filteredReviews}
          loading={loading}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '评审标题', dataIndex: 'title', render: (v, r) => (
              <a onClick={() => navigate(`/reviews/${r.id}`)}>{v}</a>
            )},
            { title: '类型', dataIndex: 'reviewType', width: 140, render: (t) => <Tag color={REVIEW_TYPE_COLOR[t]}>{REVIEW_TYPE_LABEL[t]}</Tag> },
            { title: '工作项', key: 'workItem', width: 200, render: (_, r) => r.workItem ? (
              <Space size={4}>
                <Tag>{r.workItem.key}</Tag>
                <span style={{ fontSize: 12 }}>{r.workItem.title}</span>
              </Space>
            ) : '-' },
            { title: '发起人', dataIndex: 'initiator', width: 100, render: (n) => <Space size={4}><Avatar size="small">{n[0]}</Avatar>{n}</Space> },
            { title: '状态', dataIndex: 'status', width: 100, render: (s) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag> },
            { title: '结论', dataIndex: 'conclusion', width: 100, render: (c) => c ? <Tag color={CONCLUSION_COLOR[c]}>{CONCLUSION_LABEL[c]}</Tag> : '-' },
            { title: '要素', dataIndex: ['_count', 'items'], width: 80, align: 'center', render: (n) => n || 0 },
            { title: '参与者', dataIndex: ['_count', 'participants'], width: 80, align: 'center', render: (n) => n || 0 },
            { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (t) => new Date(t).toLocaleString('zh-CN') },
            { title: '操作', width: 100, render: (_, r) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/reviews/${r.id}`)}>查看</Button>
            )},
          ]}
        />
      </Card>

      <Modal
        title="发起评审"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        width={640}
        okText="发起"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="评审模板" name="templateId" rules={[{ required: true }]}>
            <Select
              placeholder="选择评审模板"
              onChange={applyTemplate}
              options={templates.map(t => ({ value: t.id, label: `${REVIEW_TYPE_LABEL[t.reviewType]} - ${t.name}` }))}
            />
          </Form.Item>
          <Form.Item label="评审标题" name="title" rules={[{ required: true }]}>
            <Input placeholder="如：V1.0 MVP 功能评审" />
          </Form.Item>
          <Form.Item label="关联工作项" name="workItemId" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择工作项"
              filterOption={(input, option: any) =>
                option?.label?.toLowerCase().includes(input.toLowerCase())}
              options={workItems.map(i => ({
                value: i.id,
                label: `${i.key} - ${i.title}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="评审参与者" name="participants" rules={[{ required: true, message: '至少选择 1 个参与者' }]}>
            <Select
              mode="multiple"
              placeholder="选择评审人"
              options={users.map(u => ({ value: u.username, label: `${u.displayName} (${u.role})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}