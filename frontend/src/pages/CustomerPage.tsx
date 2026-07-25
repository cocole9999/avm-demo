/**
 * V1.7 客户管理页面 (V1.46.2 重构：使用通用 hooks/组件)
 * AVM 集成项目的客户档案（吉利各车型项目组）
 * - 客户列表（搜索 + 按品牌/状态过滤）
 * - 客户详情：基本信息 + 联系人（UPL/PPM/测试/开发/AVM接口人） + 关联项目
 *
 * 重构说明：
 *   - 使用 useCrudResource 替代手写 load/handleCreate/handleEdit/handleSubmit/handleDelete
 *   - 使用 useAiFormFiller 替代手写 handleAiFillCustomer
 *   - 使用 useExport 替代手写 handleExport
 *   - 使用 StatsBar / FilterBar / CrudDrawer / buildActionColumns 组件
 *   - 状态色/标签从 constants/enumMetadata 引入，消除散落定义
 */
import { useMemo, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Input, Select, Form, App,
  Tabs, Row, Col, Avatar, Empty, Tooltip, Badge,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, TeamOutlined, BankOutlined,
  PhoneOutlined, MailOutlined,
  ProjectOutlined, DollarOutlined,
} from '@ant-design/icons';
import { customerApi, contactApi, aiApi, type Customer } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { useAiFormFiller } from '../hooks/useAiFormFiller';
import { useExport } from '../hooks/useExport';
import { useAsync } from '../hooks/useAsync';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { StatsBar } from '../components/StatsBar';
import { FilterBar } from '../components/FilterBar';
import { CrudDrawer } from '../components/CrudDrawer';
import { buildActionColumns } from '../components/tableActionColumn';
import {
  CUSTOMER_STATUS_COLOR, CUSTOMER_STATUS_LABEL,
  CUSTOMER_TYPE_COLOR, CUSTOMER_TYPE_LABEL,
  CONTACT_ROLE_COLOR,
} from '../constants/enumMetadata';
import { DEFAULT_PAGINATION } from '../constants/pagination';
import { notifyApiError } from '../utils/apiError';

export function CustomerPage() {
  // V1.48: 搜索框立即响应输入，请求用防抖值（300ms）
  const [qInput, setQInput] = useState('');
  const q = useDebouncedValue(qInput, 300);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('info');

  // 查询参数构造（useCrudResource 通过 queryDeps 自动触发 reload）
  const queryBuilder = () => {
    const params: any = {};
    if (q) params.q = q;
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.type = typeFilter;
    return params;
  };

  const {
    list, loading, reload, submitting,
    editing, form, drawerOpen,
    openCreate, openEdit, closeDrawer, handleSubmit, handleDelete,
  } = useCrudResource<Customer>({
    api: customerApi,
    entityName: '客户',
    initialFormValues: { type: 'internal', status: 'active' },
    queryDeps: [q, statusFilter, typeFilter],
    queryBuilder,
  });

  // 客户统计单独加载（useCrudResource 只负责 list）
  const { data: stats, reload: reloadStats } = useAsync(
    () => customerApi.stats().catch(() => null),
    [list.length],
  );

  // AI 帮我填表单
  const { aiFilling, handleAiFill } = useAiFormFiller('customer', form, 'name', {
    requiredMessage: '请先输入客户名称',
  });

  // 导出
  const { exporting, handleExport } = useExport(
    (format) => aiApi.exportCustomers({ format }) as any,
    'customers',
  );

  // 统计聚合
  const totalProjects = useMemo(() => (list as any[]).reduce((s, c) => s + (c._count?.projects || 0), 0), [list]);
  const totalContacts = useMemo(() => (list as any[]).reduce((s, c) => s + (c._count?.contacts || 0), 0), [list]);
  const totalContract = useMemo(() => (list as any[]).reduce((s, c) =>
    s + (c.projects || []).reduce((s2: number, p: any) => s2 + (p.contractAmount || 0), 0), 0), [list]);

  const columns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      render: (v: any, r: any) => (
        <Space>
          <Avatar style={{ background: r.type === 'internal' ? '#1890ff' : '#52c41a' }} icon={<BankOutlined />} size="small" />
          <div>
            <div style={{ fontWeight: 500 }}>{v}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{r.code} · {r.shortName}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      sorter: (a: any, b: any) => (a.type || '').localeCompare(b.type || ''),
      render: (v: any) => <Tag color={CUSTOMER_TYPE_COLOR[v]}>{CUSTOMER_TYPE_LABEL[v] || v}</Tag>,
    },
    {
      title: '主联系人',
      dataIndex: 'contact',
      key: 'contact',
      width: 160,
      sorter: (a: any, b: any) => (a.contact || '').localeCompare(b.contact || ''),
      render: (v: any) => v || '-',
    },
    {
      title: '联系信息',
      key: 'contactInfo',
      width: 220,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          {r.phone && <span><PhoneOutlined /> {r.phone}</span>}
          {r.email && <span style={{ color: '#999' }}><MailOutlined /> {r.email}</span>}
        </Space>
      ),
    },
    {
      title: '项目数',
      key: 'projects',
      width: 90,
      sorter: (a: any, b: any) => (a._count?.projects || 0) - (b._count?.projects || 0),
      render: (_: any, r: any) => (
        <Tooltip title={`已关联 ${r._count?.projects || 0} 个 AVM 集成项目`}>
          <Badge count={r._count?.projects || 0} showZero color="#1890ff" />
        </Tooltip>
      ),
    },
    {
      title: '联系人数',
      key: 'contacts',
      width: 100,
      sorter: (a: any, b: any) => (a._count?.contacts || 0) - (b._count?.contacts || 0),
      render: (_: any, r: any) => (
        <Tooltip title={`UPL/PPM/测试/开发/AVM接口人 共 ${r._count?.contacts || 0} 人`}>
          <Tag icon={<TeamOutlined />} color="cyan">{r._count?.contacts || 0} 人</Tag>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
      render: (v: any) => <Tag color={CUSTOMER_STATUS_COLOR[v]}>{CUSTOMER_STATUS_LABEL[v] || v}</Tag>,
    },
    ...buildActionColumns<Customer>({
      onEdit: openEdit,
      onDelete: handleDelete,
      deleteConfirmText: '确定删除该客户？',
      deleteConfirmDescription: '关联的联系人/项目不受影响',
    }),
  ] as any;

  return (
    <div>
      {/* 顶部统计 */}
      <StatsBar
        items={[
          { title: '客户总数', value: list.length, prefix: <BankOutlined /> },
          { title: '活跃客户', value: (list as any[]).filter(c => c.status === 'active').length, valueStyle: { color: '#52c41a' } },
          { title: '关联项目', value: totalProjects, prefix: <ProjectOutlined />, valueStyle: { color: '#1890ff' } },
          { title: '合同总额（万元）', value: (totalContract / 10000).toFixed(0), prefix: <DollarOutlined />, valueStyle: { color: '#fa8c16' } },
          { title: '联系人', value: totalContacts, prefix: <TeamOutlined /> },
        ]}
      />

      {/* 过滤栏 */}
      <FilterBar
        onReload={() => { reload(); reloadStats(); }}
        loading={loading}
        onExport={handleExport}
        exportLoading={exporting}
        onCreate={openCreate}
        createText="新建客户"
      >
        <Input
          placeholder="搜索客户名称/编号/联系人"
          allowClear
          value={qInput}
          onChange={e => setQInput(e.target.value)}
          style={{ width: 240 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="客户类型"
          allowClear
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 130 }}
          options={[
            { value: 'internal', label: '内部' },
            { value: 'external', label: '外部' },
          ]}
        />
        <Select
          placeholder="状态"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 110 }}
          options={[
            { value: 'active', label: '活跃' },
            { value: 'inactive', label: '停用' },
            { value: 'archived', label: '归档' },
          ]}
        />
      </FilterBar>

      {/* 客户列表 */}
      <Card style={{ borderRadius: 8 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={DEFAULT_PAGINATION}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 编辑/创建 Drawer */}
      <CrudDrawer
        open={drawerOpen}
        editing={editing}
        title={editing ? `编辑客户：${editing.name}` : '新建客户'}
        width={720}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        submitting={submitting}
        onAiFill={handleAiFill}
        aiFilling={aiFilling}
      >
        {editing && (
          <CustomerDetail customer={editing} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
        {!editing && (
          <Form form={form} layout="vertical">
            <Form.Item name="code" label="客户编号" rules={[{ required: true }]}>
              <Input placeholder="如 GEELY-GALAXY-L7" />
            </Form.Item>
            <Form.Item name="name" label="客户名称" rules={[{ required: true }]}>
              <Input placeholder="如 吉利银河 L7 项目组" />
            </Form.Item>
            <Form.Item name="shortName" label="简称">
              <Input placeholder="如 银河L7" />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="type" label="客户类型">
                  <Select options={[
                    { value: 'internal', label: '内部（吉利内部项目组）' },
                    { value: 'external', label: '外部（预留）' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="状态">
                  <Select options={[
                    { value: 'active', label: '活跃' },
                    { value: 'inactive', label: '停用' },
                    { value: 'archived', label: '归档' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="contact" label="主联系人">
                  <Input placeholder="如 陈工（UPL）" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="联系电话">
                  <Input placeholder="如 18800001001" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="如 chen.gong@geely-galaxy-l7.demo" />
            </Form.Item>
            <Form.Item name="address" label="地址">
              <Input placeholder="如 杭州吉利研究院" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="客户背景、合作范围等" />
            </Form.Item>
          </Form>
        )}
      </CrudDrawer>
    </div>
  );
}

// 客户详情：基本信息 + 联系人 + 关联项目
function CustomerDetail({ customer, activeTab, setActiveTab }: { customer: any; activeTab: string; setActiveTab: (s: string) => void }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewForm] = Form.useForm();

  const loadContacts = async () => {
    setLoading(true);
    try {
      setContacts(await contactApi.list({ customerId: customer.id }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 每次切到联系人 tab 时重新拉取
  if (activeTab === 'contacts' && contacts.length === 0 && !loading) {
    loadContacts();
  }

  return (
    <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
      {
        key: 'info',
        label: '基本信息',
        children: (
          <Form form={viewForm} layout="vertical" initialValues={customer} disabled>
            <Form.Item name="code" label="客户编号"><Input /></Form.Item>
            <Form.Item name="name" label="客户名称"><Input /></Form.Item>
            <Form.Item name="shortName" label="简称"><Input /></Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="type" label="客户类型">
                  <Select options={[
                    { value: 'internal', label: '内部' },
                    { value: 'external', label: '外部' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="状态">
                  <Select options={[
                    { value: 'active', label: '活跃' },
                    { value: 'inactive', label: '停用' },
                    { value: 'archived', label: '归档' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="contact" label="主联系人"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="email" label="邮箱"><Input /></Form.Item>
            <Form.Item name="address" label="地址"><Input /></Form.Item>
            <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          </Form>
        ),
      },
      {
        key: 'contacts',
        label: `联系人（${customer._count?.contacts || 0}）`,
        children: (
          <ContactList customerId={customer.id} contacts={contacts} loading={loading} reload={loadContacts} />
        ),
      },
      {
        key: 'projects',
        label: `关联项目（${customer._count?.projects || 0}）`,
        children: (
          <div>
            {(customer.projects || []).length === 0 ? (
              <Empty description="暂无关联项目" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {(customer.projects || []).map((p: any) => (
                  <Card key={p.id} size="small" style={{ borderRadius: 6 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {p.code} · 车型 {p.carModel?.name} · 合同 ¥{(p.contractAmount / 10000).toFixed(1)}万
                        </div>
                      </div>
                      <Space>
                        <Tag color={p.status === 'active' ? 'green' : p.status === 'completed' ? 'blue' : 'orange'}>
                          {p.status === 'active' ? '进行中' : p.status === 'completed' ? '已完成' : p.status === 'planning' ? '规划中' : p.status}
                        </Tag>
                        <Tag color="cyan">进度 {p.progress}%</Tag>
                      </Space>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        ),
      },
    ]} />
  );
}

// 联系人列表
function ContactList({ customerId, contacts, loading, reload }: { customerId: string; contacts: any[]; loading: boolean; reload: () => void }) {
  const { message: msgApi } = App.useApp();
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submittingContact, setSubmittingContact] = useState(false);
  const [aiFillingContact, setAiFillingContact] = useState(false);

  const handleAiFillContact = async () => {
    try {
      const v = await form.validateFields(['name']);
      if (!v.name) { msgApi.warning('请先输入联系人姓名'); return; }
      setAiFillingContact(true);
      const r = await aiApi.aiFillForm('contact', { name: v.name, role: v.role, customerCode: customerId });
      if (r.filled) {
        form.setFieldsValue({
          role: r.filled.role || undefined,
          department: r.filled.department || undefined,
          phone: r.filled.phone || undefined,
          email: r.filled.email || undefined,
          feishuId: r.filled.feishuId || undefined,
          primary: r.filled.primary || false,
        });
        msgApi.success(r.reasoning || 'AI 已补全字段');
      }
    } catch (e) {
      notifyApiError(e, 'AI 填充失败：');
    } finally {
      setAiFillingContact(false);
    }
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ customerId, role: 'UPL' });
    setOpen(true);
  };

  const handleEdit = (c: any) => {
    setEditing(c);
    form.setFieldsValue(c);
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (submittingContact) return;
    setSubmittingContact(true);
    try {
      const values = await form.validateFields();
      if (editing) {
        await contactApi.update(editing.id, values);
        msgApi.success('已更新');
      } else {
        await contactApi.create({ ...values, customerId });
        msgApi.success('已添加');
      }
      setOpen(false);
      reload();
    } catch (e) {
      notifyApiError(e, '保存失败：');
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await contactApi.remove(id);
      msgApi.success('已删除');
      reload();
    } catch (e) {
      notifyApiError(e, '删除失败');
    }
  };

  return (
    <div>
      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 12 }}>
        添加联系人
      </Button>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={contacts}
        pagination={false}
        columns={[
          {
            title: '姓名', dataIndex: 'name', key: 'name',
            render: (v: any, r: any) => (
              <Space>
                <Avatar size="small" style={{ background: r.primary ? '#1890ff' : '#999' }}>{v?.[0]}</Avatar>
                {v} {r.primary && <Tag color="red" style={{ marginLeft: 4 }}>主联系人</Tag>}
              </Space>
            ),
          },
          { title: '角色', dataIndex: 'role', key: 'role', render: (v: any) => <Tag color={CONTACT_ROLE_COLOR[v] || 'default'}>{v}</Tag> },
          { title: '部门', dataIndex: 'department', key: 'department' },
          { title: '电话', dataIndex: 'phone', key: 'phone' },
          { title: '邮箱', dataIndex: 'email', key: 'email' },
          { title: '备注', dataIndex: 'note', key: 'note' },
          ...buildActionColumns({
            onEdit: handleEdit,
            onDelete: handleDelete,
            deleteConfirmText: '确定删除？',
            width: 140,
          }),
        ] as any}
      />
      <CrudDrawer
        open={open}
        editing={editing}
        title={editing ? '编辑联系人' : '添加联系人'}
        width={520}
        useModal
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submittingContact}
        onAiFill={handleAiFillContact}
        aiFilling={aiFillingContact}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { value: 'UPL', label: 'UPL（客户车型项目负责人）' },
              { value: 'PPM', label: 'PPM（客户产品经理）' },
              { value: '测试', label: '测试（客户测试工程师）' },
              { value: '开发', label: '开发（客户开发工程师）' },
              { value: 'AVM接口人', label: 'AVM接口人（客户侧 AVM 对接窗口）' },
            ]} />
          </Form.Item>
          <Form.Item name="department" label="部门"><Input placeholder="如 银河L7 项目组" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="电话"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱"><Input /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="feishuId" label="飞书 ID"><Input /></Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="primary" label="主联系人" valuePropName="checked">
            <Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} />
          </Form.Item>
        </Form>
      </CrudDrawer>
    </div>
  );
}
