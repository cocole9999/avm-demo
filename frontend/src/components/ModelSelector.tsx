/**
 * V1.55 ModelSelector — 模型选择器
 *
 * 支持：
 *   - 显示当前 provider + model
 *   - 切换 provider/model
 *   - 兼容 LLM 设置页的激活机制
 */
import { useEffect, useState } from 'react';
import { Select, Space, Spin, Tag, theme } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { llmSettingsApi } from '../api';

interface LlmStatus {
  configured: boolean;
  provider?: string;
  model?: string;
}

interface ProviderMeta {
  key: string;
  name: string;
  models: string[];
  defaultModel?: string;
}

export interface ModelSelectorProps {
  value?: { provider: string; model: string };
  onChange?: (provider: string, model: string) => void;
  size?: 'small' | 'middle' | 'large';
}

export function ModelSelector({ value, onChange, size = 'small' }: ModelSelectorProps) {
  const { token } = theme.useToken();
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setLoading(true);
    llmSettingsApi.list()
      .then((r: any) => {
        // 提取当前激活的 provider + model
        const currentProv = r.activeProviders?.[0];
        const setting = r.settings?.find((s: any) => s.provider === currentProv);
        setStatus({
          configured: !!currentProv,
          provider: currentProv,
          model: setting?.model,
        });
        // 提取所有可用 provider + models
        const provs: ProviderMeta[] = (r.providers || []).map((p: any) => ({
          key: p,
          name: p,
          models: [],
          defaultModel: '',
        }));
        setProviders(provs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentProvider = value?.provider || status?.provider;
  const currentModel = value?.model || status?.model;

  const handleChange = async (newModel: string) => {
    if (!currentProvider) return;
    setSwitching(true);
    try {
      await llmSettingsApi.quickSwitch(currentProvider, newModel);
      onChange?.(currentProvider, newModel);
    } catch (e: any) {
      // 静默失败，让上层 toast
    } finally {
      setSwitching(false);
    }
  };

  if (loading) return <Spin size="small" />;

  const provider = providers.find(p => p.key === currentProvider);
  const models = provider?.models || [];

  return (
    <Select
      size={size}
      value={currentModel}
      onChange={handleChange}
      style={{ minWidth: 140 }}
      loading={switching}
      placeholder="选择模型"
      suffixIcon={<ApiOutlined />}
      options={models.map(m => ({ value: m, label: m }))}
      notFoundContent={currentProvider ? '当前 provider 无可用模型' : '请先在 LLM 设置中配置'}
    />
  );
}
