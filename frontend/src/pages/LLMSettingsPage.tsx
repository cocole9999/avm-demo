/**
 * LLM 大模型设置页 (V1.47 重构)
 *
 * 新设计：
 * - 不再列出所有 10 个预置 provider
 * - 顶部「添加模型」按钮 + 已配置数 + 主 provider 状态
 * - 已配置 provider 卡片网格（含 logo/名称/模型/API Key 状态/启用开关/主标记/编辑/删除）
 * - 添加按钮弹出选择框，从预置中选或选 custom
 * - 卡片编辑打开配置 Modal（含 ModelsEditor + 测试连接/聊天）
 */
import { useEffect, useState } from 'react';
import {
  Card, Tag, Space, Button, Modal, Form, Input, Switch, App, Spin,
  Empty, Alert, Tooltip, Popconfirm, Row, Col, Badge, Select,
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, ThunderboltOutlined, StarOutlined, StarFilled,
  ExperimentOutlined, ReloadOutlined, DeleteOutlined, KeyOutlined, PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { llmSettingsApi } from '../api';
import { StatsBar } from '../components/StatsBar';
import { PageHeaderBar } from '../components/PageHeaderBar';
import { notifyApiError } from '../utils/apiError';

interface Provider {
  key: string;
  name: string;
  logo: string;
  defaultBaseUrl: string;
  defaultModel: string;
  protocol: string;
}

interface Setting {
  id?: string;
  provider: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  currentModel?: string;
  enabled: boolean;
  isPrimary: boolean;
  note: string;
}

export function LLMSettingsPage() {
  const { message } = App.useApp();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Setting | null>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  // 添加厂商选择 Modal
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    try {
      const r = await llmSettingsApi.list();
      setProviders(r.providers as unknown as Provider[]);
      setSettings(r.settings as unknown as Setting[]);
      setStatus(r.status);
    } catch (e) { notifyApiError(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getMeta = (key: string) => providers.find(p => p.key === key);

  // 已配置的 provider 列表（用于卡片展示）
  const configuredSettings = settings.filter(s => s.apiKey || s.id);

  // 未配置的预置 provider（用于添加按钮的下拉）
  const availableProviders = providers.filter(p => !settings.find(s => s.provider === p.key));

  const openConfig = (providerKey: string) => {
    const meta = getMeta(providerKey);
    const existing = settings.find(s => s.provider === providerKey);
    const initial: any = existing || {
      provider: providerKey,
      name: meta?.name,
      baseUrl: meta?.defaultBaseUrl,
      model: meta?.defaultModel,
      enabled: true,
      isPrimary: settings.length === 0,  // 第一个自动设为主
      note: '',
      apiKey: '',
    };
    setEditing(initial);
    form.setFieldsValue(initial);
    setTestResult(null);
    setModalOpen(true);
  };

  const handleAdd = () => {
    if (!selectedProvider) {
      message.warning('请选择要添加的模型厂商');
      return;
    }
    setAddOpen(false);
    openConfig(selectedProvider);
    setSelectedProvider(undefined);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const v = await form.validateFields();
      if (v.apiKey && v.apiKey.includes('***')) v.apiKey = '';
      await llmSettingsApi.upsert(editing.provider, v);
      message.success('已保存');
      setModalOpen(false);
      load();
    } catch (e) { notifyApiError(e); }
  };

  const handleTest = async () => {
    if (!editing) return;
    try {
      const v = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      const { model: _ignore, ...payload } = v;
      const r = await llmSettingsApi.test(editing.provider, payload);
      setTestResult(r);
      if (r.success) message.success(`${r.message}（${r.latencyMs}ms）`);
      else message.error(`失败：${r.message}`);
    } catch (e) { notifyApiError(e); }
    finally { setTesting(false); }
  };

  const handleTestChat = async () => {
    if (!editing) return;
    try {
      const v = await form.validateFields();
      const { model: _ignore, ...payload } = v;
      const v2 = { ...payload, provider: editing.provider, prompt: '你好，请用一句话介绍你自己' };
      setTesting(true);
      setTestResult(null);
      const r = await llmSettingsApi.testChat(v2);
      setTestResult(r);
      if (r.success) message.success(`回复成功（${r.latencyMs}ms）`);
      else message.error(`失败：${r.message}`);
    } catch (e) { notifyApiError(e); }
    finally { setTesting(false); }
  };

  const handleSetPrimary = async (provider: string) => {
    try {
      await llmSettingsApi.setPrimary(provider);
      message.success(`已切换主 provider 为 ${provider}`);
      load();
    } catch (e) { notifyApiError(e); }
  };

  const handleDelete = async (provider: string) => {
    try {
      await llmSettingsApi.remove(provider);
      message.success('已删除');
      load();
    } catch (e) { notifyApiError(e); }
  };

  return (
    <div>
      <PageHeaderBar
        icon={<ApiOutlined />}
        title="大模型设置"
        tag={status?.configured ? { text: `主: ${status.displayName || status.provider} · ${status.model}`, color: 'green' } : { text: 'Mock 兜底', color: 'default' }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加模型</Button>
          </Space>
        }
      />

      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="添加并配置大模型后，AI 助理（估分/归类/问答/周报）会自动调用真实大模型"
        description={
          <div>
            <div>• 点击右上角「添加模型」选择厂商并填入 API Key</div>
            <div>• 标记「主」的 provider 将作为 AI 助理默认调用对象</div>
            <div>• 不配置任何 provider 时自动 fallback 到启发式引擎，演示无影响</div>
            <div>• API Key 加密存储（AES-256-GCM），生产部署建议挂到 Vault/K8s Secret</div>
          </div>
        }
      />

      <StatsBar
        items={[
          { title: '已配置厂商', value: configuredSettings.length, prefix: <ApiOutlined />, valueStyle: { color: '#1890ff' } },
          { title: '启用中', value: configuredSettings.filter(s => s.enabled).length, valueStyle: { color: '#52c41a' } },
          { title: '主 provider', value: status?.configured ? (status.displayName || status.provider) : 'Mock', valueStyle: { color: status?.configured ? '#52c41a' : '#999' } },
          { title: '可选厂商', value: availableProviders.length, prefix: <KeyOutlined /> },
        ]}
      />

      {/* 已配置厂商卡片网格 */}
      <Card style={{ borderRadius: 8, minHeight: 200 }} loading={loading}>
        {configuredSettings.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" align="center">
                <span>尚未配置任何大模型厂商</span>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加第一个模型</Button>
              </Space>
            }
            style={{ padding: 40 }}
          />
        ) : (
          <Row gutter={[12, 12]}>
            {configuredSettings.map(s => {
              const meta = getMeta(s.provider);
              const current = s.currentModel || s.model;
              const hasKey = s.apiKey && s.apiKey.length > 4;
              return (
                <Col key={s.provider} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      border: s.isPrimary ? '2px solid #faad14' : '1px solid #f0f0f0',
                      position: 'relative',
                    }}
                    styles={{ body: { padding: 12 } }}
                  >
                    {/* 主 provider 角标 */}
                    {s.isPrimary && (
                      <Tag color="gold" icon={<StarFilled />} style={{ position: 'absolute', top: -8, right: 8 }}>主</Tag>
                    )}
                    {/* 头部 */}
                    <Space align="start" style={{ width: '100%', marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>{meta?.logo || '🤖'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name || meta?.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#999' }}>{s.provider} · {meta?.protocol || 'openai'}</div>
                      </div>
                    </Space>
                    {/* 当前模型 */}
                    <div style={{ marginBottom: 8 }}>
                      <Tooltip title={s.currentModel ? `当前生效模型（默认: ${s.model}）` : '默认模型'}>
                        <Tag color={s.currentModel && s.currentModel !== s.model ? 'purple' : 'blue'} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {current || '未设置'}
                          {s.currentModel && s.currentModel !== s.model && ' ★'}
                        </Tag>
                      </Tooltip>
                    </div>
                    {/* 状态行 */}
                    <Space size={4} style={{ fontSize: 12, marginBottom: 8 }}>
                      <Badge status={hasKey ? 'success' : 'default'} text={hasKey ? 'Key 已配' : 'Key 未配'} />
                      <span style={{ color: '#ccc' }}>·</span>
                      <Badge status={s.enabled ? 'success' : 'default'} text={s.enabled ? '启用' : '停用'} />
                    </Space>
                    {/* 操作 */}
                    <Space size={4} style={{ width: '100%' }}>
                      <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openConfig(s.provider)} style={{ padding: 0 }}>编辑</Button>
                      {!s.isPrimary && (
                        <Tooltip title="设为主 provider">
                          <Button size="small" type="link" icon={<StarOutlined />} onClick={() => handleSetPrimary(s.provider)} style={{ padding: 0 }}>设主</Button>
                        </Tooltip>
                      )}
                      <Popconfirm title="确定删除此配置？" onConfirm={() => handleDelete(s.provider)}>
                        <Button size="small" type="link" danger icon={<DeleteOutlined />} style={{ padding: 0 }}>删除</Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      {/* 配置 Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `配置 ${getMeta(editing.provider)?.name || editing.provider}` : '配置'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={680}
        okText="保存"
      >
        {editing && (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="显示名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Row gutter={12}>
              <Col span={14}><Form.Item name="baseUrl" label="API Base URL" tooltip="留空用默认值">
                <Input placeholder={getMeta(editing.provider)?.defaultBaseUrl} />
              </Form.Item></Col>
              <Col span={10}><Form.Item name="model" label="默认模型" tooltip="留空用默认值">
                <Input placeholder={getMeta(editing.provider)?.defaultModel} />
              </Form.Item></Col>
            </Row>
            <Form.Item name="apiKey" label="API Key" tooltip="支持 OpenAI/Anthropic 协议；Ollama 可留空">
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}><Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={12}><Form.Item name="isPrimary" label="主 provider" valuePropName="checked"><Switch /></Form.Item></Col>
            </Row>
            <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="如：内部知识库专用 / 仅供 PM 使用" /></Form.Item>
            <div style={{ fontSize: 12, color: '#999', marginTop: -12, marginBottom: 12 }}>
              💡 温度和 maxTokens 由系统按模型自动选择（不传 temperature 用 API 默认 1.0；maxTokens 按模型上限智能推断）
            </div>

            <ModelsEditor provider={editing.provider} />

            <Space>
              <Button icon={<ThunderboltOutlined />} loading={testing} onClick={handleTest}>测试连接</Button>
              <Button icon={<ExperimentOutlined />} loading={testing} onClick={handleTestChat}>测试聊天</Button>
            </Space>

            {testResult && (
              <Alert
                style={{ marginTop: 12 }}
                type={testResult.success ? 'success' : 'error'}
                showIcon
                message={
                  testResult.success
                    ? `成功（${testResult.latencyMs || 0}ms）${testResult.model ? ` · 模型 ${testResult.model}` : ''}`
                    : `失败：${testResult.message}`
                }
                description={testResult.message && testResult.success ? <pre style={{ background: '#fafafa', padding: 8, borderRadius: 4, maxHeight: 120, overflow: 'auto', fontSize: 12 }}>{testResult.message}</pre> : null}
              />
            )}
          </Form>
        )}
      </Modal>

      {/* 添加厂商选择 Modal */}
      <Modal
        open={addOpen}
        title="添加大模型厂商"
        onCancel={() => { setAddOpen(false); setSelectedProvider(undefined); }}
        onOk={handleAdd}
        okText="下一步：配置"
        cancelText="取消"
        width={520}
      >
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
          选择要添加的厂商，配置 API Key 后即可使用。可重复添加 <code>custom</code> 类型来配置多个 OpenAI 兼容端点。
        </div>
        <Select
          placeholder="选择厂商"
          value={selectedProvider}
          onChange={setSelectedProvider}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={[
            ...availableProviders.map(p => ({
              value: p.key,
              label: `${p.logo} ${p.name} (${p.key})`,
            })),
            // 如果所有预置都已配置，仍允许添加 custom
            ...(availableProviders.find(p => p.key === 'custom') ? [] : [{
              value: 'custom',
              label: '🤖 自定义 OpenAI 兼容 (custom)',
            }]),
          ]}
        />
        {selectedProvider && (
          <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            {(() => {
              const meta = getMeta(selectedProvider);
              if (!meta) return null;
              return (
                <div style={{ fontSize: 12, color: '#666' }}>
                  <div><strong>{meta.logo} {meta.name}</strong></div>
                  <div>协议：{meta.protocol}</div>
                  <div>默认 Base URL：{meta.defaultBaseUrl || '(空)'}</div>
                  <div>默认模型：{meta.defaultModel || '(空)'}</div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}

// 模型管理子组件（保留原样）
function ModelsEditor({ provider }: { provider: string }) {
  const { message } = App.useApp();
  const [models, setModels] = useState<{ builtin: string[]; custom: string[]; current: string; all: string[] }>({ builtin: [], custom: [], current: '', all: [] });
  const [newModel, setNewModel] = useState('');

  const load = async () => {
    try { setModels(await llmSettingsApi.listModels(provider)); } catch {}
  };
  useEffect(() => { load(); }, [provider]);

  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const switchTo = async (m: string) => {
    if (switchingTo) return;
    setSwitchingTo(m);
    try {
      const r = await llmSettingsApi.switchModel(provider, m);
      setModels(prev => ({ ...prev, current: m }));
      message.success(`已切换到 ${m}`);
      window.dispatchEvent(new CustomEvent('llm-status-updated', { detail: { provider, model: m } }));
    } catch (e) { notifyApiError(e); }
    finally { setSwitchingTo(null); }
  };
  const addModel = async () => {
    if (!newModel.trim()) return;
    try {
      await llmSettingsApi.addCustomModel(provider, newModel.trim());
      setNewModel('');
      load();
    } catch (e) { notifyApiError(e); }
  };
  const removeModel = async (m: string) => {
    try {
      await llmSettingsApi.removeCustomModel(provider, m);
      load();
    } catch (e) { notifyApiError(e); }
  };

  return (
    <div style={{ background: '#fafafa', padding: 12, borderRadius: 6, marginTop: 8 }}>
      <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff', borderRadius: 4, border: '1px solid #d9b3ff' }}>
        <span style={{ fontSize: 12, color: '#666' }}>当前生效模型：</span>
        <Tag color="purple" style={{ marginLeft: 6, fontSize: 14, padding: '2px 10px', fontWeight: 500 }}>
          {models.current || '未选（走 defaultModel）'}
          {switchingTo && <Spin size="small" style={{ marginLeft: 6 }} />}
        </Tag>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>预置模型（点击切换）</div>
      <div style={{ marginBottom: 8 }}>
        {models.builtin.length === 0 ? <span style={{ color: '#ccc', fontSize: 12 }}>该 provider 无预置模型，请手动添加</span> :
          models.builtin.map(m => {
            const isCurrent = m === models.current;
            const isSwitching = switchingTo === m;
            return (
              <Tag
                key={m}
                color={isCurrent ? 'gold' : 'blue'}
                style={{ cursor: 'pointer', marginBottom: 4, padding: '4px 10px', fontSize: 13, userSelect: 'none' }}
                onClick={() => switchTo(m)}
              >
                {isSwitching ? <Spin size="small" style={{ marginRight: 4 }} /> : isCurrent ? '★ ' : '○ '}{m}
              </Tag>
            );
          })
        }
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>自定义模型</div>
      <div style={{ marginBottom: 8 }}>
        {models.custom.length === 0 ? <span style={{ color: '#ccc', fontSize: 12 }}>暂无</span> :
          models.custom.map(m => {
            const isCurrent = m === models.current;
            const isSwitching = switchingTo === m;
            return (
              <Tag
                key={m}
                color={isCurrent ? 'gold' : 'cyan'}
                style={{ cursor: 'pointer', marginBottom: 4, padding: '4px 10px', fontSize: 13, userSelect: 'none' }}
                onClick={() => switchTo(m)}
                closable
                onClose={(e) => { e.preventDefault(); removeModel(m); }}
              >
                {isSwitching ? <Spin size="small" style={{ marginRight: 4 }} /> : isCurrent ? '★ ' : '○ '}{m}
              </Tag>
            );
          })
        }
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Input value={newModel} onChange={e => setNewModel(e.target.value)} placeholder="添加自定义模型（如 gpt-4-32k）" onPressEnter={addModel} />
        <Button type="primary" onClick={addModel}>添加</Button>
      </Space.Compact>
    </div>
  );
}
