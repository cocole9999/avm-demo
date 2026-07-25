import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Segmented, Button, Input, Select, Space, Tag, Modal, Form, DatePicker,
  Dropdown, message, Tooltip, Empty, Avatar, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, FilterOutlined, TableOutlined, DownloadOutlined,
  AppstoreOutlined, BarChartOutlined, MoreOutlined, DeleteOutlined,
  RobotOutlined, HolderOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { workItemApi, metaApi, aiApi } from '../api';
import { downloadBlob, getFilenameFromResponse } from '../utils/download';
import { notifyApiError } from '../utils/apiError';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUrlState } from '../hooks/useUrlState';
import { useSavedFilters } from '../hooks/useSavedFilters';
import type { WorkItem, WorkItemType, MetaOptions } from '../types';
import { PRIORITY_COLOR, STATUS_COLOR, TYPE_COLOR, TYPE_LABEL } from '../types';
import { TableView } from '../views/TableView';
import { KanbanView } from '../views/KanbanView';
import { GanttView } from '../views/GanttView';
import { SortableListView } from '../views/SortableListView';
import { useWorkItemChanged } from '../services/useWorkItemChanged';
import { DuplicateBugAlert } from '../components/DuplicateBugAlert';
import { SavedFilterButton } from '../components/SavedFilterButton';

export function WorkItemsPage() {
  const { type = 'requirement' } = useParams<{ type: WorkItemType }>();
  const navigate = useNavigate();

  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MetaOptions | null>(null);

  // V1.48: 筛选/视图/搜索状态同步到 URL（刷新不丢失，可分享链接）
  const [view, setView] = useUrlState<'table' | 'kanban' | 'gantt' | 'sortable'>('view', 'table');
  const [filterStatus, setFilterStatus] = useUrlState<string>('status', '');
  const [filterPriority, setFilterPriority] = useUrlState<string>('priority', '');
  const [filterAssignee, setFilterAssignee] = useUrlState<string>('assignee', '');
  const [filterIteration, setFilterIteration] = useUrlState<string>('iteration', '');
  const [searchText, setSearchText] = useState('');  // 搜索框立即响应输入，但请求用防抖值
  const debouncedSearch = useDebouncedValue(searchText, 300);
  const [exporting, setExporting] = useState(false);

  // V1.50: 保存筛选条件（localStorage 持久化）
  const currentFilters = useMemo(() => ({
    status: filterStatus,
    priority: filterPriority,
    assignee: filterAssignee,
    iteration: filterIteration,
    search: debouncedSearch,
    view,
  }), [filterStatus, filterPriority, filterAssignee, filterIteration, debouncedSearch, view]);
  const { savedFilters, saveFilter, deleteFilter, applyFilter, shareFilter, cloudError } = useSavedFilters(`work-items-${type}`, currentFilters, { cloudSync: true });
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveFilterShared, setSaveFilterShared] = useState(false);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(true);
    try {
      const params: any = { format };
      if (type) params.type = type;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterAssignee) params.assignee = filterAssignee;
      const blob = await aiApi.exportWorkItems(params);
      const filename = getFilenameFromResponse((blob as any)?.headers, `work-items-${type || 'all'}-${new Date().toISOString().slice(0,10)}.${format}`);
      downloadBlob(blob as Blob, filename);
    } catch (e) {
      notifyApiError(e, '导出失败：');
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { type };
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterAssignee) params.assignee = filterAssignee;
      if (filterIteration) params.iterationId = filterIteration;
      if (debouncedSearch) params.q = debouncedSearch;
      const data = await workItemApi.list(params);
      setItems(data);
    } catch (e) {
      notifyApiError(e, '加载失败：');
    } finally {
      setLoading(false);
    }
  }, [type, filterStatus, filterPriority, filterAssignee, filterIteration, debouncedSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { metaApi.options().then(setOptions); }, []);
  // V1.47: AI 修改工作项后自动刷新列表
  useWorkItemChanged(() => { load(); });

  // 当 type 变化时清掉不适用筛选
  useEffect(() => {
    setFilterStatus('');
  }, [type, setFilterStatus]);

  const statusList = options?.statusByType[type as WorkItemType]?.values || [];

  // 创建
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [aiFilling, setAiFilling] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  // V1.50: 监听新建表单字段用于 Bug 重复检测
  const newTitle = Form.useWatch('title', form);
  const newDescription = Form.useWatch('description', form);
  const isBugCreate = createOpen && type === 'bug';
  // V1.50: AI 一键归类
  const [autoClassifying, setAutoClassifying] = useState(false);

  const handleAutoClassify = async () => {
    try {
      const v = await form.validateFields(['title']);
      if (!v.title) { message.warning('请先输入标题'); return; }
      setAutoClassifying(true);
      const r = await aiApi.autoClassify({
        title: v.title,
        type: type as string,
        priority: v.priority,
        hint: v.description,
      });
      if (r.filled) {
        const f = r.filled;
        form.setFieldsValue({
          type: f.type || type,
          priority: f.priority || 'P2',
          description: f.description || v.description || '',
          estimate: f.estimate || undefined,
          assignee: f.assignee || undefined,
          module: f.module || undefined,
        });
        const filled: string[] = [];
        if (f.type) filled.push('类型');
        if (f.priority) filled.push('优先级');
        if (f.description) filled.push('描述');
        if (f.estimate) filled.push('估分');
        if (f.assignee) filled.push('负责人');
        if (f.module) filled.push('模块');
        message.success(`AI 一键归类完成: ${filled.join('、')}`);
      }
    } catch (e) {
      notifyApiError(e, 'AI 一键归类失败：');
    } finally {
      setAutoClassifying(false);
    }
  };

  const handleAiFill = async () => {
    try {
      const v = await form.validateFields(['title']);
      if (!v.title) {
        message.warning('请先输入标题');
        return;
      }
      setAiFilling(true);
      const r = await aiApi.aiFillWorkItem({ title: v.title, type: type as string, hint: '' });
      if (r.filled) {
        const f = r.filled;
        form.setFieldsValue({
          type: f.type || type,
          priority: f.priority || 'P2',
          description: f.description || '',
          estimate: f.estimate || undefined,
          assignee: f.assignee || undefined,
        });
        message.success(r.reasoning || 'AI 已补全字段');
      }
    } catch (e) {
      notifyApiError(e, 'AI 填充失败：');
    } finally {
      setAiFilling(false);
    }
  };

  const handleAiSuggestAssignee = async () => {
    try {
      const v = await form.validateFields(['title', 'priority']);
      if (!v.title) { message.warning('请先输入标题'); return; }
      setAiSuggesting(true);
      const r = await aiApi.aiSuggestAssignee({
        title: v.title, type: type as string, priority: v.priority || 'P2',
      });
      if (r.assignee) {
        form.setFieldValue('assignee', r.assignee);
        message.success(`AI 推荐: ${r.assignee} — ${r.reasoning || ''}`);
      }
    } catch (e) {
      notifyApiError(e, 'AI 推荐失败：');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await workItemApi.create({
        type: type as WorkItemType,
        title: values.title,
        description: values.description || '',
        priority: values.priority || 'P2',
        assignee: values.assignee || undefined,
        module: values.module || undefined,
        estimate: values.estimate,
        planStart: values.planRange?.[0]?.toISOString(),
        planEnd: values.planRange?.[1]?.toISOString(),
      });
      message.success('创建成功');
      setCreateOpen(false);
      form.resetFields();
      load();
      // 通知其他页面
      window.dispatchEvent(new CustomEvent('avm-data-changed'));
    } catch (e) {
      notifyApiError(e, '创建失败：');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复',
      okType: 'danger',
      onOk: async () => {
        await workItemApi.delete(id);
        message.success('已删除');
        load();
      },
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await workItemApi.update(id, { status });
      message.success(`已流转到 ${status}`);
      load();
    } catch (e) {
      notifyApiError(e, '流转失败：');
    }
  };

  const renderItemLink = (item: WorkItem) => (
    <a onClick={() => navigate(`/work-items/${item.type}/${item.id}`)}>
      <Tag color={TYPE_COLOR[item.type]} style={{ marginRight: 6 }}>{item.key}</Tag>
      {item.title}
    </a>
  );

  return (
    <div>
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: 12 } }}
      >
        <Space wrap>
          <Segmented
            value={view}
            onChange={(v) => setView(v as 'table' | 'kanban' | 'gantt' | 'sortable')}
            options={[
              { value: 'table', label: <span><TableOutlined /> 表格</span> },
              { value: 'kanban', label: <span><AppstoreOutlined /> 看板</span> },
              { value: 'gantt', label: <span><BarChartOutlined /> 甘特</span> },
              { value: 'sortable', label: <span><HolderOutlined /> 拖拽</span> },
            ]}
          />
          <Input.Search
            placeholder="搜索标题 / 编号"
            style={{ width: 220 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={() => load()}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusList.map(s => ({ value: s, label: <Tag color={STATUS_COLOR[s]}>{s}</Tag> }))}
          />
          <Select
            placeholder="优先级"
            allowClear
            style={{ width: 110 }}
            value={filterPriority}
            onChange={setFilterPriority}
            options={['P0', 'P1', 'P2', 'P3'].map(p => ({ value: p, label: <Tag color={PRIORITY_COLOR[p]}>{p}</Tag> }))}
          />
          <Select
            placeholder="负责人"
            allowClear
            style={{ width: 130 }}
            value={filterAssignee}
            onChange={setFilterAssignee}
            options={[...new Set(items.map(i => i.assignee).filter(Boolean))].map(a => ({ value: a, label: a }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          {/* V1.50: 保存当前筛选 + V1.52: 团队共享（已抽到 SavedFilterButton 组件） */}
          <SavedFilterButton
            currentFilters={currentFilters}
            applyFilters={(f) => {
              setFilterStatus(f.status || '');
              setFilterPriority(f.priority || '');
              setFilterAssignee(f.assignee || '');
              setFilterIteration(f.iteration || '');
              setSearchText(f.search || '');
              if (f.view) setView(f.view as any);
            }}
            savedFilters={savedFilters}
            onSave={(name, shared) => saveFilter(name, shared)}
            onDelete={(id) => deleteFilter(id)}
            onShare={(id, shared) => shareFilter(id, shared)}
            cloudError={cloudError}
          />
          <Dropdown
            menu={{
              items: [
                { key: 'xlsx', label: '导出 Excel (.xlsx)', onClick: () => handleExport('xlsx') },
                { key: 'csv', label: '导出 CSV (.csv)', onClick: () => handleExport('csv') },
              ],
            }}
          >
            <Button icon={<DownloadOutlined />} loading={exporting}>导出</Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建{TYPE_LABEL[type as WorkItemType]}
          </Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: view === 'kanban' || view === 'sortable' ? 12 : 0 } }}>
        {items.length === 0 && !loading ? (
          <Empty description="暂无数据，点击右上角创建第一条记录" />
        ) : view === 'table' ? (
          <TableView items={items} loading={loading} onStatusChange={handleStatusChange} onDelete={handleDelete} onRefresh={load} onOpenItem={(it) => navigate(`/work-items/${it.type}/${it.id}`)} />
        ) : view === 'kanban' ? (
          <KanbanView items={items} statusList={statusList} onStatusChange={handleStatusChange} onClickItem={(it) => navigate(`/work-items/${it.type}/${it.id}`)} />
        ) : view === 'sortable' ? (
          <SortableListView items={items} type={type} onItemClick={(it) => navigate(`/work-items/${it.type}/${it.id}`)} onStatusChange={handleStatusChange} />
        ) : (
          <GanttView items={items} onClickItem={(it) => navigate(`/work-items/${it.type}/${it.id}`)} />
        )}
      </Card>

      <Modal
        title={`新建${TYPE_LABEL[type as WorkItemType]}`}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        width={680}
        footer={[
          <Button key="ai" icon={<ThunderboltOutlined />} onClick={handleAiFill} loading={aiFilling}>
            AI 帮我填
          </Button>,
          // V1.50: AI 一键归类（合并填表+推荐负责人）
          <Button key="auto" type="primary" ghost icon={<RobotOutlined />} onClick={handleAutoClassify} loading={autoClassifying}>
            AI 一键归类
          </Button>,
          <Button key="cancel" onClick={() => setCreateOpen(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={creating} onClick={handleCreate}>创建</Button>,
        ]}
      >
        <Form form={form} layout="vertical" initialValues={{ priority: 'P2' }}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="一句话描述清楚这个工作项" />
          </Form.Item>
          {/* V1.50: Bug 类型时显示 AI 重复检测（输入标题后自动检测 90 天内相似 Bug） */}
          <DuplicateBugAlert
            title={newTitle || ''}
            description={newDescription}
            enabled={isBugCreate}
          />
          <Form.Item label="详细描述" name="description">
            <Input.TextArea rows={4} placeholder="补充背景、验收标准等" />
          </Form.Item>
          <Space>
            <Form.Item label="优先级" name="priority" style={{ width: 110 }}>
              <Select options={['P0', 'P1', 'P2', 'P3'].map(p => ({ value: p }))} />
            </Form.Item>
            <Form.Item label="负责人" name="assignee" style={{ width: 140 }}>
              <Select
                allowClear
                placeholder="选择"
                options={['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九'].map(p => ({ value: p }))}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: 4, borderTop: '1px solid #f0f0f0' }}>
                      <Button type="link" size="small" icon={<RobotOutlined />} onClick={handleAiSuggestAssignee} loading={aiSuggesting}>
                        AI 推荐负责人
                      </Button>
                    </div>
                  </>
                )}
              />
            </Form.Item>
            <Form.Item label="模块" name="module" style={{ width: 160 }}>
              <Input placeholder="如：登录模块" />
            </Form.Item>
            <Form.Item label="估分" name="estimate" style={{ width: 100 }}>
              <Input type="number" placeholder="故事点" />
            </Form.Item>
          </Space>
          <Form.Item label="计划时间" name="planRange">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}