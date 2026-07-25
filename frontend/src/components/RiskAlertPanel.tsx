/**
 * V1.49 风险预警面板 (V1.50 增强: Top N 排行 + 红点提醒 + 跳转)
 *
 * 功能：
 * - 调用 aiRiskScan 立即扫描所有项目
 * - 列出高风险项目（红/黄/绿）+ 延期工作项（Top N 排行）
 * - 提供「导出风险」和「查看项目详情」快捷入口
 * - 一键触发通知推送给相关人员
 * - V1.50: 排序（severity + 项目风险）+ 跳转项目页 + 紧凑模式自动刷新 + 红点徽章
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Tag, List, Spin, Alert, Empty, Tooltip, Progress, message, Badge, Statistic, Row, Col,
} from 'antd';
import {
  WarningOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  ReloadOutlined, DownloadOutlined, BellOutlined, FireOutlined,
  ClockCircleOutlined, ProjectOutlined, ArrowRightOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { aiApi } from '../api';
import { downloadBlob, getFilenameFromResponse } from '../utils/download';
import { notifyApiError } from '../utils/apiError';

interface RiskProject {
  projectCode: string;
  projectName: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  daysOverdue?: number;
  progress?: number;
}

interface OverdueItem {
  id: string;
  name: string;
  type: string;
  projectCode: string;
  daysOverdue: number;
  status: string;
}

interface RiskScanResult {
  scannedAt: string;
  riskCount: number;
  overdueCount: number;
  notificationsCreated: number;
  skippedByDedup: number;
  alerts: { projectCode: string; severity: string; summary: string }[];
  dependencyOverdue?: {
    overdueCount: number;
    notificationsCreated: number;
    skippedByDedup: number;
    items: OverdueItem[];
  };
}

const SEVERITY_CONFIG = {
  high: { color: 'red', icon: <FireOutlined />, label: '高风险', bg: '#fff1f0', order: 0 },
  medium: { color: 'orange', icon: <WarningOutlined />, label: '中风险', bg: '#fff7e6', order: 1 },
  low: { color: 'green', icon: <CheckCircleOutlined />, label: '低风险', bg: '#f6ffed', order: 2 },
} as const;

// V1.50: Top N 配置
const TOP_N = 5;

interface Props {
  /** 嵌入模式：紧凑卡片（用于 Dashboard）或完整面板 */
  variant?: 'compact' | 'full';
  /** 自动刷新间隔（毫秒），0 禁用 */
  autoRefreshMs?: number;
}

export function RiskAlertPanel({ variant = 'full', autoRefreshMs = 0 }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskScanResult | null>(null);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);

  const runScan = async () => {
    setLoading(true);
    try {
      const r = await aiApi.aiRiskScan();
      setResult(r);
      setLastScanned(new Date());
      if (r.riskCount === 0 && r.overdueCount === 0) {
        message.success('✅ 扫描完成：当前无风险项目');
      } else {
        message.warning(`⚠️ 发现 ${r.riskCount} 个风险项目，${r.overdueCount} 个延期工作项`);
      }
    } catch (e) {
      notifyApiError(e, '风险扫描失败：');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoRefreshMs > 0) {
      const t = setInterval(runScan, autoRefreshMs);
      return () => clearInterval(t);
    }
  }, [autoRefreshMs]);

  const handleExport = async () => {
    try {
      const blob = await aiApi.exportRisks();
      const filename = getFilenameFromResponse((blob as any)?.headers, `risks-${new Date().toISOString().slice(0, 10)}.xlsx`);
      downloadBlob(blob as Blob, filename);
      message.success('已导出风险清单');
    } catch (e) {
      notifyApiError(e, '导出失败：');
    }
  };

  // V1.50: 排序 - 优先级（high > medium > low）+ Top N
  const sortedAlerts = [...(result?.alerts || [])].sort((a: any, b: any) => {
    const orderA = (SEVERITY_CONFIG as any)[a.severity]?.order ?? 99;
    const orderB = (SEVERITY_CONFIG as any)[b.severity]?.order ?? 99;
    return orderA - orderB;
  });
  const topAlerts = sortedAlerts.slice(0, TOP_N);
  const remainingCount = sortedAlerts.length - topAlerts.length;

  // 紧凑模式：只显示计数 + 红色高风险数 + 红点
  if (variant === 'compact') {
    const highCount = result?.alerts?.filter(a => a.severity === 'high').length || 0;
    return (
      <Card
        size="small"
        title={
          <Space>
            <Badge dot={highCount > 0} color="red" offset={[-2, 2]}>
              <FireOutlined style={{ color: highCount > 0 ? '#ff4d4f' : '#999' }} />
            </Badge>
            <span>风险预警</span>
            {highCount > 0 && <Tag color="red">{highCount}</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button
              type={highCount > 0 ? 'primary' : 'default'}
              danger={highCount > 0}
              size="small"
              icon={<ReloadOutlined />}
              onClick={runScan}
              loading={loading}
            >
              扫描
            </Button>
          </Space>
        }
      >
        {result ? (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="高风险"
                  value={result.alerts?.filter((a: any) => a.severity === 'high').length || 0}
                  valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
                  prefix={<FireOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="中风险"
                  value={result.alerts?.filter((a: any) => a.severity === 'medium').length || 0}
                  valueStyle={{ color: '#faad14', fontSize: 20 }}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="延期"
                  value={result.overdueCount}
                  valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
            </Row>
            {/* V1.50: Top N 风险项目（紧凑模式下也显示） */}
            {topAlerts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  <TrophyOutlined /> Top {Math.min(TOP_N, topAlerts.length)} 风险项目
                </div>
                {topAlerts.map((a: any, i: number) => {
                  const cfg = (SEVERITY_CONFIG as any)[a.severity] || SEVERITY_CONFIG.low;
                  return (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => navigate(`/projects?code=${encodeURIComponent(a.projectCode)}`)}
                    >
                      <Tag color={cfg.color} style={{ margin: 0, fontSize: 10 }}>{cfg.label}</Tag>
                      <span style={{ fontWeight: 500 }}>{a.projectCode}</span>
                      <span style={{ color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={'点击右上角"扫描"按钮'} />
        )}
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Badge dot={(result?.alerts?.filter((a: any) => a.severity === 'high').length || 0) > 0} color="red" offset={[-2, 2]}>
            <FireOutlined style={{ color: '#ff4d4f' }} />
          </Badge>
          <span>AI 风险预警面板</span>
          {lastScanned && (
            <span style={{ fontSize: 12, color: '#999', fontWeight: 'normal' }}>
              上次扫描：{lastScanned.toLocaleTimeString('zh-CN')}
            </span>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<BellOutlined />}
            onClick={runScan}
            loading={loading}
          >
            立即扫描 + 推送通知
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!result}
          >
            导出风险清单
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {!result ? (
          <Empty
            description="尚未扫描"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={runScan}>开始扫描</Button>
          </Empty>
        ) : (
          <>
            {/* 顶部统计 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small" style={{ background: SEVERITY_CONFIG.high.bg }}>
                  <Statistic
                    title="高风险项目"
                    value={result.alerts?.filter((a: any) => a.severity === 'high').length || 0}
                    prefix={<FireOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: SEVERITY_CONFIG.medium.bg }}>
                  <Statistic
                    title="中风险项目"
                    value={result.alerts?.filter((a: any) => a.severity === 'medium').length || 0}
                    prefix={<WarningOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#f0f5ff' }}>
                  <Statistic
                    title="延期工作项"
                    value={result.overdueCount}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#f6ffed' }}>
                  <Statistic
                    title="已推送通知"
                    value={result.notificationsCreated}
                    prefix={<BellOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 全部健康 */}
            {result.riskCount === 0 && result.overdueCount === 0 ? (
              <Alert
                type="success"
                showIcon
                message="✅ 当前无风险项目"
                description="所有项目均按计划进行，无延期工作项"
              />
            ) : (
              <>
                {/* V1.50: Top N 风险项目（按严重度排序） */}
                {topAlerts.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 8 }}>
                      <TrophyOutlined style={{ color: '#faad14' }} /> Top {topAlerts.length} 风险项目
                      {remainingCount > 0 && <Tag color="default" style={{ marginLeft: 8 }}>还有 {remainingCount} 个</Tag>}
                    </h4>
                    <List
                      size="small"
                      bordered
                      dataSource={topAlerts}
                      renderItem={(item: any, idx: number) => {
                        const cfg = (SEVERITY_CONFIG as any)[item.severity] || SEVERITY_CONFIG.low;
                        return (
                          <List.Item
                            style={{ background: cfg.bg, cursor: 'pointer' }}
                            actions={[
                              <Tooltip key="view" title="跳转到项目">
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<ArrowRightOutlined />}
                                  onClick={() => navigate(`/projects?code=${encodeURIComponent(item.projectCode)}`)}
                                />
                              </Tooltip>,
                            ]}
                          >
                            <Space>
                              <Badge count={idx + 1} style={{ backgroundColor: idx === 0 ? '#ff4d4f' : idx === 1 ? '#faad14' : '#52c41a' }} />
                              <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>
                              <strong>{item.projectCode}</strong>
                              <span style={{ color: '#666' }}>{item.summary}</span>
                            </Space>
                          </List.Item>
                        );
                      }}
                    />
                  </>
                )}

                {/* V1.50: Top 延期工作项 */}
                {result.dependencyOverdue?.items && result.dependencyOverdue.items.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 16 }}>
                      <ExclamationCircleOutlined /> 延期工作项 Top {Math.min(TOP_N, result.dependencyOverdue.items.length)}
                      {result.dependencyOverdue.overdueCount > TOP_N && <Tag color="default" style={{ marginLeft: 8 }}>共 {result.dependencyOverdue.overdueCount} 个</Tag>}
                    </h4>
                    <List
                      size="small"
                      bordered
                      dataSource={result.dependencyOverdue.items.slice(0, TOP_N)}
                      renderItem={(item) => (
                        <List.Item>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Space>
                              <Tag color="red">延期 {item.daysOverdue} 天</Tag>
                              <span>{item.name}</span>
                              <Tag>{item.type}</Tag>
                              <span style={{ color: '#999' }}>{item.projectCode}</span>
                            </Space>
                            <Tooltip title="跳转到工作项详情">
                              <Button
                                type="link"
                                size="small"
                                onClick={() => window.open(`/work-items/${item.type}/${item.id}`, '_blank')}
                              >
                                查看 →
                              </Button>
                            </Tooltip>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </>
                )}
              </>
            )}

            {/* 去重提示 */}
            {result.skippedByDedup > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={`${result.skippedByDedup} 个通知因 24h 内重复已被合并`}
              />
            )}
          </>
        )}
      </Spin>
    </Card>
  );
}
