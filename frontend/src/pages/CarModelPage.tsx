/**
 * V1.7 车型库管理页面 (V1.46.2 重构：使用通用 hooks/组件)
 * 吉利全系车型档案：银河 / 极氪 / 领克 / 博越 / 熊猫 / 星瑞 等
 *
 * 重构说明：
 *   - 使用 useCrudResource 替代手写 CRUD 四件套
 *   - 使用 useAiFormFiller 替代手写 handleAiFill
 *   - 使用 StatsBar / FilterBar / CrudDrawer / buildActionColumns 组件
 *   - 状态/细分市场色从 constants/enumMetadata 引入
 */
import { useMemo, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Input, Select, Form,
  Row, Col, Avatar, Tooltip,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, CarOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { carModelApi, type CarModel } from '../api';
import { useCrudResource } from '../hooks/useCrudResource';
import { useAiFormFiller } from '../hooks/useAiFormFiller';
import { useAsync } from '../hooks/useAsync';
import { StatsBar } from '../components/StatsBar';
import { FilterBar } from '../components/FilterBar';
import { CrudDrawer } from '../components/CrudDrawer';
import { buildActionColumns } from '../components/tableActionColumn';
import { CAR_SEGMENT_COLOR, CAR_STATUS_COLOR, CAR_STATUS_LABEL } from '../constants/enumMetadata';

const SEGMENT_OPTIONS = [
  '紧凑型 SUV', '中型 SUV', '中大型 SUV',
  '紧凑型轿车', '中型轿车', '中大型车',
  '猎装轿跑', 'MPV', '微型车',
].map(v => ({ value: v, label: v }));

export function CarModelPage() {
  const [q, setQ] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const queryBuilder = () => {
    const params: any = {};
    if (q) params.q = q;
    if (brandFilter) params.brand = brandFilter;
    if (statusFilter) params.status = statusFilter;
    return params;
  };

  const {
    list, loading, reload, submitting,
    editing, form, drawerOpen,
    openCreate, openEdit, closeDrawer, handleSubmit, handleDelete,
  } = useCrudResource<CarModel>({
    api: carModelApi,
    entityName: '车型',
    initialFormValues: { status: 'active', launchYear: new Date().getFullYear() },
    queryDeps: [q, brandFilter, statusFilter],
    queryBuilder,
  });

  // 品牌分布单独加载
  const { data: byBrand, reload: reloadByBrand } = useAsync(
    () => carModelApi.byBrand().catch(() => null),
    [list.length],
  );

  // AI 帮我填（车型场景：除 name 外还可传 brand 作为 hint）
  const { aiFilling, handleAiFill } = useAiFormFiller('car_model', form, 'name', {
    requiredMessage: '请先输入车型名称',
    extraPayload: () => {
      const brand = form.getFieldValue('brand');
      return brand ? { brand } : {};
    },
  });

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    (list as any[]).forEach(m => set.add(m.brand));
    return Array.from(set).map(b => ({ value: b, label: b }));
  }, [list]);

  const totalProjects = useMemo(() => (list as any[]).reduce((s, m) => s + (m._count?.projects || 0), 0), [list]);
  const totalWorkItems = useMemo(() => (list as any[]).reduce((s, m) => s + (m._count?.workItems || 0), 0), [list]);

  const columns = [
    {
      title: '车型',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (v: any, r: any) => (
        <Space>
          <Avatar style={{ background: '#722ed1' }} icon={<CarOutlined />} size="small" />
          <div>
            <div style={{ fontWeight: 500 }}>{v}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{r.code} · {r.series || '-'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 110,
      render: (v: any) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: '细分市场',
      dataIndex: 'segment',
      key: 'segment',
      width: 130,
      render: (v: any) => v ? <Tag color={CAR_SEGMENT_COLOR[v] || 'default'}>{v}</Tag> : '-',
    },
    {
      title: '上市年份',
      dataIndex: 'launchYear',
      key: 'launchYear',
      width: 100,
      render: (v: any) => v || '-',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 110,
      render: (v: any) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '关联项目',
      key: 'projects',
      width: 110,
      render: (_: any, r: any) => (
        <Tooltip title={`${r._count?.projects || 0} 个 AVM 集成项目`}>
          <Tag icon={<ProjectOutlined />} color="blue">{r._count?.projects || 0}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '工作项',
      key: 'workItems',
      width: 100,
      render: (_: any, r: any) => (
        <Tooltip title={`${r._count?.workItems || 0} 个工作项`}>
          <Tag>{r._count?.workItems || 0}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: any) => <Tag color={CAR_STATUS_COLOR[v] || 'default'}>{CAR_STATUS_LABEL[v] || v}</Tag>,
    },
    ...buildActionColumns<CarModel>({
      onEdit: openEdit,
      onDelete: handleDelete,
      deleteConfirmText: '确定删除该车型？',
    }),
  ] as any;

  const brandDistObj = (byBrand as any)?.byBrand || {};
  const brandDistKeys = Object.keys(brandDistObj);

  return (
    <div>
      {/* 顶部统计 */}
      <StatsBar
        items={[
          { title: '车型总数', value: list.length, prefix: <CarOutlined /> },
          { title: '覆盖品牌', value: brandDistKeys.length || brandOptions.length, valueStyle: { color: '#722ed1' } },
          { title: '关联项目', value: totalProjects, prefix: <ProjectOutlined />, valueStyle: { color: '#1890ff' } },
          { title: '工作项', value: totalWorkItems, valueStyle: { color: '#52c41a' } },
          { title: '在售车型', value: (list as any[]).filter(m => m.status === 'active').length, valueStyle: { color: '#fa8c16' } },
        ]}
      />

      {/* 品牌分布条 */}
      {byBrand && brandDistKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, borderRadius: 8 }} title="品牌分布">
          <Space wrap>
            {brandDistKeys.map((brand) => (
              <Tag key={brand} color="geekblue" style={{ padding: '4px 10px', fontSize: 13 }}>
                {brand} <strong style={{ marginLeft: 4 }}>{brandDistObj[brand] as number}</strong> 款
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* 过滤栏 */}
      <FilterBar
        onReload={() => { reload(); reloadByBrand(); }}
        loading={loading}
        onCreate={openCreate}
        createText="新建车型"
      >
        <Input
          placeholder="搜索车型名称/编号/平台"
          allowClear
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 240 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="品牌"
          allowClear
          value={brandFilter}
          onChange={setBrandFilter}
          style={{ width: 140 }}
          options={brandOptions}
        />
        <Select
          placeholder="状态"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 110 }}
          options={[
            { value: 'active', label: '在售' },
            { value: 'inactive', label: '停售' },
            { value: 'archived', label: '归档' },
          ]}
        />
      </FilterBar>

      <Card style={{ borderRadius: 8 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <CrudDrawer
        open={drawerOpen}
        editing={editing}
        title={editing ? `编辑车型：${editing.name}` : '新建车型'}
        width={560}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        submitting={submitting}
        onAiFill={handleAiFill}
        aiFilling={aiFilling}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="车型编号" rules={[{ required: true }]}>
            <Input placeholder="如 GALAXY-L7" />
          </Form.Item>
          <Form.Item name="name" label="车型名称" rules={[{ required: true }]}>
            <Input placeholder="如 银河L7" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="brand" label="品牌" rules={[{ required: true }]}>
                <Input placeholder="如 吉利银河" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="series" label="系列">
                <Input placeholder="如 L系列" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="segment" label="细分市场">
                <Select allowClear options={SEGMENT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="launchYear" label="上市年份">
                <Input type="number" placeholder="如 2023" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="platform" label="平台">
                <Input placeholder="如 GEEA 2.0 / SEA 浩瀚 / CMA" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select options={[
                  { value: 'active', label: '在售' },
                  { value: 'inactive', label: '停售' },
                  { value: 'archived', label: '归档' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="AVM 集成相关信息" />
          </Form.Item>
        </Form>
      </CrudDrawer>
    </div>
  );
}
