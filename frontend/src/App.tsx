import { useEffect, useRef, useState } from 'react';
import { Layout, Menu, theme, Badge, Avatar, Tag, Dropdown, Space, List, Empty, Button, message, notification as antdNotification, Tooltip, Modal } from 'antd';
import {
  AppstoreOutlined, ProjectOutlined, BarChartOutlined,
  BellOutlined, UserOutlined, TeamOutlined, RocketOutlined,
  PartitionOutlined, AuditOutlined, FundProjectionScreenOutlined,
  AppstoreAddOutlined, ScheduleOutlined, StarOutlined, StarFilled,
  ApartmentOutlined, FunctionOutlined, ThunderboltOutlined, ApiOutlined, FileTextOutlined, ToolOutlined, LineChartOutlined, CameraOutlined, ExperimentOutlined, BankOutlined, CarOutlined, ShopOutlined, ProjectOutlined as ProjectIcon, ImportOutlined,
  CheckOutlined, LogoutOutlined, CalendarOutlined, WifiOutlined, DisconnectOutlined,
  BulbOutlined, BulbFilled,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { iterationApi, metaApi, notificationApi, favoriteApi, spaceApi, aiApi, type SpaceType, type Favorite } from './api';
import type { Iteration } from './types';
import { useAuth } from './AuthContext';
import { useThemeMode } from './ThemeContext';
import { GlobalAIAssistant } from './components/GlobalAIAssistant';
import { AgentPane } from './components/AgentPane';
import { useAgentPanel } from './components/AgentPanelContext';
import { InlineAskButton } from './components/InlineAskButton';
import { wsClient } from './services/ws';

const { Header, Sider, Content } = Layout;

export default function App() {
  const { user, token: authToken, logout } = useAuth();
  const CURRENT_USER = user?.username || '';
  const [collapsed, setCollapsed] = useState(false);
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [spaces, setSpaces] = useState<SpaceType[]>([]);
  const [currentSpace, setCurrentSpace] = useState<SpaceType | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // V1.55.10: 全局 AI 助理状态（由 Logo 旁按钮控制）
  const [globalAIAssistantOpen, setGlobalAIAssistantOpen] = useState(false);
  const [hasConfiguredLlm, setHasConfiguredLlm] = useState(false);
  const [globalMessageCount, setGlobalMessageCount] = useState(0);
  // V1.55.12: 移除顶部全局搜索框（NL 搜索 + 关键词搜索），改为通过 AI 助理进行检索
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  // V1.52: 通知下拉面板预览（前 5 条最新未读，WS 收到时插入头部）
  const [notifPreview, setNotifPreview] = useState<any[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { token: themeToken } = theme.useToken();
  const { isDark, toggle: toggleTheme } = useThemeMode();
  // V1.55: Agent 面板状态
  const agentPanel = useAgentPanel();

  useEffect(() => {
    iterationApi.list().then(setIterations).catch(() => {});
    metaApi.stats().then(setStats).catch(() => {});
    spaceApi.list().then(s => {
      setSpaces(s);
      setCurrentSpace(s[0] || null);
    }).catch(() => {});
    // 通知
    const refreshNotifs = () => notificationApi.unreadCount(CURRENT_USER).then(r => setUnreadCount(r.count)).catch(() => {});
    refreshNotifs();
    const t = setInterval(refreshNotifs, 30000);
    return () => clearInterval(t);
  }, []);

  // V1.55.10: 加载 LLM 配置状态（用于 Logo 旁 AI 按钮的样式）
  useEffect(() => {
    if (!authToken) {
      setHasConfiguredLlm(false);
      return;
    }
    const loadLlm = () => aiApi.llmStatus()
      .then((r: any) => setHasConfiguredLlm(!!r?.configured))
      .catch(() => setHasConfiguredLlm(false));
    loadLlm();
    const t = setInterval(loadLlm, 60000);
    return () => clearInterval(t);
  }, [authToken]);

  // V1.55.10: 监听 sessionStorage 同步 GlobalAIAssistant 的消息数
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = sessionStorage.getItem('avm-global-ai-history') || sessionStorage.getItem('avm-ai-history') || '[]';
        const arr = JSON.parse(raw);
        setGlobalMessageCount(Array.isArray(arr) ? arr.filter((m: any) => m.role === 'user').length : 0);
      } catch { setGlobalMessageCount(0); }
    };
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    favoriteApi.list(CURRENT_USER).then(setFavorites).catch(() => {});
  }, []);

  // V1.15: WebSocket 实时通知
  const [wsStatus, setWsStatus] = useState<string>('idle');
  useEffect(() => {
    if (!authToken) { wsClient.disconnect(); return; }
    wsClient.connect(authToken);
    const offStatus = wsClient.onStatusChange(setWsStatus);
    const offNotif = wsClient.on('notification', (msg) => {
      const n = msg.notification;
      if (!n) return;
      // 增加未读计数
      setUnreadCount(c => c + 1);
      // V1.52: 插入下拉面板预览（最多 5 条）
      setNotifPreview(prev => [n, ...prev].slice(0, 5));
      // 顶部 toast
      const kindIcon = n.kind === 'mention' ? '💬' : n.kind === 'handover' ? '🔄' : n.kind === 'dep_overdue' ? '📦' : n.kind === 'risk_alert' ? '🚨'
        : n.kind === 'watch_status_change' ? '⭐' : n.kind === 'watch_comment_added' ? '⭐' : '🔔';
      antdNotification.open({
        message: `${kindIcon} ${n.title || '新通知'}`,
        description: (n.content || '').slice(0, 120),
        placement: 'topRight',
        duration: 6,
        btn: n.link ? (
          <Button type="primary" size="small" onClick={() => navigate(n.link)}>
            查看 →
          </Button>
        ) : undefined,
        onClick: () => { if (n.link) navigate(n.link); },
      });
    });
    return () => { offStatus(); offNotif(); };
  }, [authToken, navigate]);

  // 登出时断开 ws
  useEffect(() => {
    if (!authToken) wsClient.disconnect();
  }, [authToken]);

  // V1.28 全局键盘快捷键（V1.48: 用 useRef 替代 (window as any).__avm_lastG）
  const [helpOpen, setHelpOpen] = useState(false);
  const lastGRef = useRef<number>(0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 排除输入框/可编辑元素
      const target = e.target as HTMLElement;
      const isEditable = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      // Esc 总是处理
      if (e.key === 'Escape') {
        // Modal 关闭由 antd 自己处理
        return;
      }
      // 输入框内: 不响应其他快捷键
      if (isEditable) return;
      // V1.55: Ctrl+U 唤起/关闭 AI 助理面板（先处理带修饰键的，否则会被通用规则 return）
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U') && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        agentPanel.togglePanel();
        return;
      }
      // V1.55.10: Ctrl+K 唤起/关闭全局 AI 助理
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setGlobalAIAssistantOpen(v => !v);
        return;
      }
      // 修饰键: 不响应 (留给浏览器)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case '/':
          e.preventDefault();
          const searchInput = document.querySelector('input[placeholder*="搜索"]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
          break;
        case '?':
          e.preventDefault();
          setHelpOpen(true);
          break;
        case 'g':
          // 'g' 后面跟另一个键形成组合 (j/k/gg/d/w/i/n)
          // V1.48: 用 useRef 替代 window 全局，避免污染 window 对象和绕过类型系统
          const lastG = lastGRef.current;
          if (Date.now() - lastG < 800) {
            lastGRef.current = 0;
          } else {
            lastGRef.current = Date.now();
            return;
          }
          break;
        case 'd':
          if (lastGRef.current && Date.now() - lastGRef.current < 800) {
            lastGRef.current = 0;
            navigate('/dashboard');
          }
          break;
        case 'w':
          if (lastGRef.current && Date.now() - lastGRef.current < 800) {
            lastGRef.current = 0;
            navigate('/workbench');
          }
          break;
        case 'i':
          if (lastGRef.current && Date.now() - lastGRef.current < 800) {
            lastGRef.current = 0;
            navigate('/imports');
          }
          break;
        case 'r':
          if (lastGRef.current && Date.now() - lastGRef.current < 800) {
            lastGRef.current = 0;
            navigate('/reports');
          }
          break;
        case 'a':
          if (lastGRef.current && Date.now() - lastGRef.current < 800) {
            lastGRef.current = 0;
            navigate('/audit-logs');
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // 从 URL 推断当前选中菜单
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/workbench')) return 'workbench';
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/work-items/requirement')) return 'requirement';
    if (path.startsWith('/work-items/task')) return 'task';
    if (path.startsWith('/work-items/bug')) return 'bug';
    if (path.startsWith('/work-items/release')) return 'release';
    if (path.startsWith('/flows')) return 'flows';
    if (path.startsWith('/reviews')) return 'reviews';
    if (path.startsWith('/dashboards') || path.startsWith('/charts')) return 'dashboards';
    if (path.startsWith('/ai')) return 'ai';
    if (path.startsWith('/notifications')) return 'notifications';
    if (path.startsWith('/resources')) return 'resources';
    if (path.startsWith('/tree')) return 'tree';
    if (path.startsWith('/fields')) return 'fields';
    if (path.startsWith('/automation')) return 'automation';
    if (path.startsWith('/analysis')) return 'analysis';
    if (path.startsWith('/baselines')) return 'baselines';
    if (path.startsWith('/mcp')) return 'mcp';
    if (path.startsWith('/tests')) return 'tests';
    if (path.startsWith('/tenants')) return 'tenants';
    if (path.startsWith('/llm-settings')) return 'llm-settings';
    if (path.startsWith('/customers')) return 'customers';
    if (path.startsWith('/car-models')) return 'car-models';
    if (path.startsWith('/projects')) return 'projects';
    if (path.startsWith('/dependencies')) return 'dependencies';
    if (path.startsWith('/resources')) return 'resources';
    if (path.startsWith('/gantt')) return 'gantt';
    if (path.startsWith('/users')) return 'users';
    if (path.startsWith('/audit-logs')) return 'audit-logs';
    if (path.startsWith('/imports')) return 'imports';
    if (path.startsWith('/reports')) return 'reports';
    if (path.startsWith('/agent-stats')) return 'agent-stats';
    return 'workbench';
  };

  const selectedKey = getSelectedKey();

  const getTitle = () => {
    switch (selectedKey) {
      case 'workbench': return '我的工作台';
      case 'dashboard': return '项目仪表盘';
      case 'requirement': return '需求管理';
      case 'task': return '任务管理';
      case 'bug': return '缺陷管理';
      case 'release': return '版本管理';
      case 'flows': return '流程引擎';
      case 'reviews': return '评审中心';
      case 'dashboards': return '度量仪表盘';
      case 'ai': return 'AI 智能助理';
      case 'notifications': return '通知中心';
      case 'resources': return '人员排期';
      case 'tree': return '树形视图';
      case 'fields': return '字段配置';
      case 'automation': return '自动化';
      case 'analysis': return 'AI 人力分析';
      case 'baselines': return '基线管理';
      case 'mcp': return 'MCP Server';
      case 'tests': return '测试管理';
      case 'tenants': return '企业管理';
      case 'llm-settings': return '大模型设置';
      case 'customers': return '客户管理';
      case 'car-models': return '车型库';
      case 'projects': return '项目管理';
      case 'dependencies': return '外部依赖';
      case 'gantt': return '甘特图';
      case 'users': return '用户管理';
      case 'audit-logs': return '审计日志';
      case 'imports': return '数据导入';
      case 'reports': return '周报月报';
      case 'agent-stats': return 'Agent 使用统计';
      default: return '';
    }
  };

  // V1.55.12: 已移除顶部全局搜索框（handleNlSearch / handleNlNavigate / handleSearch），
  // 关键词搜索与 NL 自然语言搜索改由 AI 助理提供。

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead(CURRENT_USER);
    setUnreadCount(0);
    setNotifPreview([]);  // V1.52: 全部已读后清空预览
    message.success('已全部标为已读');
  };

  const handleToggleFav = async (fav: Favorite) => {
    await favoriteApi.remove(fav.id);
    setFavorites(prev => prev.filter(f => f.id !== fav.id));
    message.success('已取消收藏');
  };

  // 通知下拉面板
  const notifPanel = (
    <div style={{ width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 12, maxHeight: 480, overflow: 'auto' }}>
      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500 }}>未读通知（{unreadCount}）</span>
        <Button type="link" size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>全部已读</Button>
      </Space>
      {notifPreview.length === 0 ? (
        <div style={{ padding: '20px 0', color: '#999', textAlign: 'center', fontSize: 12 }}>暂无未读</div>
      ) : (
        <List
          size="small"
          dataSource={notifPreview}
          renderItem={(n: any) => (
            <List.Item
              style={{ cursor: n.link ? 'pointer' : 'default', padding: '6px 8px' }}
              onClick={() => { if (n.link) navigate(n.link); }}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    <span style={{ fontSize: 12 }}>{
                      n.kind === 'watch_status_change' || n.kind === 'watch_comment_added' ? '⭐' :
                      n.kind === 'mention' ? '💬' : n.kind === 'handover' ? '🔄' :
                      n.kind === 'dep_overdue' ? '📦' : n.kind === 'risk_alert' ? '🚨' : '🔔'
                    }</span>
                    <span style={{ fontSize: 13 }}>{n.title}</span>
                  </Space>
                }
                description={<span style={{ fontSize: 11, color: '#999' }}>{(n.content || '').slice(0, 50)}</span>}
              />
            </List.Item>
          )}
        />
      )}
      <Button type="link" block onClick={() => { navigate('/notifications'); }}>
        打开通知中心
      </Button>
    </div>
  );

  // 收藏下拉
  const favPanel = (
    <div style={{ width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 12, maxHeight: 480, overflow: 'auto' }}>
      <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500 }}>我的收藏（{favorites.length}）</span>
        <Button type="link" size="small" onClick={() => navigate('/workbench')}>工作台管理</Button>
      </Space>
      {favorites.length === 0 ? (
        <Empty description="暂无收藏" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={favorites}
          renderItem={(f) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '6px 8px' }}
              actions={[<StarFilled key="s" style={{ color: '#faad14' }} onClick={(e) => { e.stopPropagation(); handleToggleFav(f); }} />]}
              onClick={() => navigate(f.link)}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13 }}>{f.title}</span>}
                description={<span style={{ fontSize: 11, color: '#999' }}>{f.subtitle}</span>}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  // 空间切换
  const spaceMenu = {
    items: spaces.map(s => ({
      key: s.id,
      label: (
        <Space onClick={() => setCurrentSpace(s)}>
          <AppstoreAddOutlined />
          <span>{s.name}</span>
          {currentSpace?.id === s.id && <CheckOutlined style={{ color: themeToken.colorPrimary }} />}
        </Space>
      ),
    })),
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light" width={232} aria-label="主导航侧边栏" role="navigation" style={{ height: '100vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          height: 56, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          gap: 8, flexShrink: 0, paddingLeft: collapsed ? 8 : 16, paddingRight: collapsed ? 8 : 16,
        }}>
          {/* V1.55.10: AI 助理悬浮按钮（缩小放在 Logo 左侧） */}
          <Tooltip title={`AI 助理 (Ctrl+K) — ${hasConfiguredLlm ? '已就绪' : '未配置 LLM'}`}>
            <Badge count={globalMessageCount} size="small" offset={[-2, 2]} color="#722ed1">
              <Button
                type="text"
                size="small"
                onClick={() => setGlobalAIAssistantOpen(true)}
                style={{
                  width: 28, height: 28, minWidth: 28, padding: 0, flexShrink: 0,
                  background: hasConfiguredLlm ? 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)' : '#f0f0f0',
                  color: hasConfiguredLlm ? '#fff' : '#999',
                  border: 'none',
                  boxShadow: hasConfiguredLlm ? '0 2px 6px rgba(22,119,255,0.3)' : 'none',
                }}
                aria-label="打开 AI 助理"
              >
                <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>AI</span>
              </Button>
            </Badge>
          </Tooltip>
          <RocketOutlined style={{ fontSize: 22, color: themeToken.colorPrimary, flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AVM 项目中心</span>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['grp-work']}
          inlineCollapsed={collapsed}
          style={{ borderRight: 0, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
          items={[
            // ========== 1. 工作区 (每天用) ==========
            {
              key: 'grp-home',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>工作区</span>,
              children: [
                { key: 'workbench', icon: <AppstoreOutlined />, label: <Link to="/workbench">工作台</Link> },
                { key: 'dashboard', icon: <BarChartOutlined />, label: <Link to="/dashboard">项目仪表盘</Link> },
                { key: 'watching', icon: <StarOutlined />, label: <Link to="/watching">我的关注</Link> },
              ],
            },
            // ========== 2. 工作项 (核心实体) ==========
            {
              key: 'grp-work',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>工作项</span>,
              children: [
                {
                  key: 'work',
                  icon: <ProjectOutlined />,
                  label: '工作项',
                  children: [
                    { key: 'requirement', label: <Link to="/work-items/requirement">需求</Link> },
                    { key: 'task', label: <Link to="/work-items/task">任务</Link> },
                    { key: 'bug', label: <Link to="/work-items/bug">缺陷</Link> },
                    { key: 'release', label: <Link to="/work-items/release">版本</Link> },
                  ],
                },
                { key: 'gantt', icon: <CalendarOutlined />, label: <Link to="/gantt">甘特图</Link> },
                { key: 'tree', icon: <ApartmentOutlined />, label: <Link to="/tree">树形视图</Link> },
                { key: 'dependencies', icon: <ToolOutlined />, label: <Link to="/dependencies">外部依赖</Link> },
                { key: 'resources', icon: <ScheduleOutlined />, label: <Link to="/resources">人员排期</Link> },
              ],
            },
            // ========== 3. 度量与报告 ==========
            {
              key: 'grp-metrics',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>度量与报告</span>,
              children: [
                { key: 'reports', icon: <FileTextOutlined />, label: <Link to="/reports">周报月报</Link> },
                { key: 'dashboards', icon: <FundProjectionScreenOutlined />, label: <Link to="/dashboards">度量仪表盘</Link> },
                { key: 'reviews', icon: <AuditOutlined />, label: <Link to="/reviews">评审中心</Link> },
                { key: 'tests', icon: <ExperimentOutlined />, label: <Link to="/tests">测试管理</Link> },
                { key: 'analysis', icon: <LineChartOutlined />, label: <Link to="/analysis">AI 人力分析</Link> },
              ],
            },
            // ========== 4. 流程配置 (低频但重要) ==========
            {
              key: 'grp-flow',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>流程配置</span>,
              children: [
                { key: 'flows', icon: <PartitionOutlined />, label: <Link to="/flows">流程引擎</Link> },
                { key: 'automation', icon: <ThunderboltOutlined />, label: <Link to="/automation">无代码自动化</Link> },
                { key: 'fields', icon: <FunctionOutlined />, label: <Link to="/fields">字段配置</Link> },
              ],
            },
            // ========== 5. 空间与数据 (管理员) ==========
            {
              key: 'grp-data',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>空间与数据</span>,
              children: [
                { key: 'projects', icon: <ProjectIcon />, label: <Link to="/projects">项目管理</Link> },
                { key: 'tenants', icon: <BankOutlined />, label: <Link to="/tenants">企业管理</Link> },
                { key: 'customers', icon: <ShopOutlined />, label: <Link to="/customers">客户管理</Link> },
                { key: 'car-models', icon: <CarOutlined />, label: <Link to="/car-models">车型库</Link> },
                { key: 'imports', icon: <ImportOutlined />, label: <Link to="/imports">数据导入</Link> },
                { key: 'baselines', icon: <CameraOutlined />, label: <Link to="/baselines">基线管理</Link> },
              ],
            },
            // ========== 6. 系统管理 (管理员) ==========
            {
              key: 'grp-system',
              type: 'group',
              label: collapsed ? null : <span style={{ fontSize: 11, color: '#999', fontWeight: 500, letterSpacing: 0.5 }}>系统管理</span>,
              children: [
                { key: 'users', icon: <UserOutlined />, label: <Link to="/users">用户管理</Link> },
                { key: 'audit-logs', icon: <AuditOutlined />, label: <Link to="/audit-logs">审计日志</Link> },
                { key: 'llm-settings', icon: <ApiOutlined />, label: <Link to="/llm-settings">大模型设置</Link> },
                { key: 'mcp', icon: <ApiOutlined />, label: <Link to="/mcp">MCP Server</Link> },
                { key: 'agent-stats', icon: <ExperimentOutlined />, label: <Link to="/agent-stats">Agent 统计</Link> },
              ],
            },
          ]}
        />

        {!collapsed && iterations.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${themeToken.colorBorderSecondary}`, flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: themeToken.colorTextTertiary, marginBottom: 8 }}>
              <TeamOutlined /> 当前迭代
            </div>
            {iterations.filter(i => i.status === 'active').map(i => (
              <div key={i.id} style={{
                padding: 8, borderRadius: 6, background: themeToken.colorFillTertiary,
                marginBottom: 6, fontSize: 13,
              }}>
                <div style={{ fontWeight: 500 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: themeToken.colorTextTertiary, marginTop: 4 }}>
                  {new Date(i.startDate).toLocaleDateString('zh-CN')} ~ {new Date(i.endDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </Sider>

      <Layout>
        <Header style={{
          padding: '0 24px', background: '#fff',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }} role="banner" aria-label="顶部导航栏">
          <Space>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{getTitle()}</div>
            {currentSpace && (
              <Dropdown menu={spaceMenu} trigger={['click']}>
                <Button type="text" icon={<AppstoreAddOutlined />}>
                  {currentSpace.name} ▾
                </Button>
              </Dropdown>
            )}
          </Space>

          <Space size={16} style={{ flex: 1, justifyContent: 'flex-end' }}>
            {/* V1.55.12: 已移除顶部全局搜索框（关键词 + NL 双模式），改由 AI 助理提供检索能力 */}

            {stats && (
              <div style={{ fontSize: 13, color: themeToken.colorTextSecondary }}>
                共 <b style={{ color: themeToken.colorPrimary }}>{stats.total}</b> 个工作项
                {' · '}P0 <Badge color="red" text={stats.byPriority.P0 || 0} />
                {' · '}P1 <Badge color="orange" text={stats.byPriority.P1 || 0} />
              </div>
            )}

            {/* 收藏 */}
            <Dropdown popupRender={() => favPanel} trigger={['click']}>
              <StarOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Dropdown>

            {/* 通知 */}
            <Dropdown popupRender={() => notifPanel} trigger={['click']}>
              <Badge count={unreadCount} size="small">
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
              </Badge>
            </Dropdown>
            {/* V1.15: ws 状态指示 */}
            <Tooltip title={wsStatus === 'connected' ? '实时通知已连接' : wsStatus === 'connecting' ? '连接中…' : '通知离线 (将自动重连)'}>
              {wsStatus === 'connected' ? <WifiOutlined style={{ fontSize: 14, color: '#52c41a' }} /> : <DisconnectOutlined style={{ fontSize: 14, color: wsStatus === 'connecting' ? '#faad14' : '#bfbfbf' }} />}
            </Tooltip>

            {/* V1.50: 暗色主题切换 */}
            <Tooltip title={isDark ? '切换为亮色主题' : '切换为暗色主题'}>
              <Button
                type="text"
                shape="circle"
                icon={isDark ? <BulbFilled style={{ color: '#faad14', fontSize: 16 }} /> : <BulbOutlined style={{ fontSize: 16 }} />}
                onClick={toggleTheme}
                aria-label="切换主题"
              />
            </Tooltip>

            <Dropdown
              menu={{
                items: [
                  {
                    key: 'info',
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <div style={{ fontWeight: 500 }}>{user?.displayName}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>@{user?.username} · {user?.role}</div>
                      </div>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: () => {
                      logout();
                      message.success('已退出');
                      navigate('/login', { replace: true });
                    },
                  },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: themeToken.colorPrimary }} icon={<UserOutlined />} />
                <span style={{ fontSize: 13 }}>{user?.displayName}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 16, display: 'flex', minHeight: 0, height: 'calc(100vh - 64px - 32px)', overflow: 'hidden' }} role="main" aria-label="主要内容区域">
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Outlet />
          </div>
          {/* V1.55: Agent 面板（嵌入模式下位于 Sider 与右侧内容之间） */}
          <AgentPane />
        </Content>
      </Layout>
      {/* V1.55.10: 全局 AI 助理 — 悬浮按钮已移到 Logo 左侧, 由 external open 控制 */}
      <GlobalAIAssistant
        open={globalAIAssistantOpen}
        onOpenChange={setGlobalAIAssistantOpen}
        hideFloatButton
      />

      {/* V1.55.5: 选区动作按钮（选中文本时弹出"问 AI"） */}
      <InlineAskButton />

      {/* V1.28 键盘快捷键帮助 */}
      <Modal
        title={<Space><RocketOutlined /> 键盘快捷键</Space>}
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button type="primary" onClick={() => setHelpOpen(false)}>知道了</Button>}
        width={520}
      >
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div><b>导航</b>（g + 字母）</div>
          <div style={{ paddingLeft: 16, color: '#666' }}>
            <div><kbd>g d</kbd> → 仪表盘</div>
            <div><kbd>g w</kbd> → 工作台</div>
            <div><kbd>g i</kbd> → 数据导入</div>
            <div><kbd>g r</kbd> → AI 报告</div>
            <div><kbd>g a</kbd> → 审计日志</div>
          </div>
          <div style={{ marginTop: 8 }}><b>全局</b></div>
          <div style={{ paddingLeft: 16, color: '#666' }}>
            <div><kbd>/</kbd> → 聚焦顶部搜索框</div>
            <div><kbd>Ctrl+U</kbd> → 切换 AI 助理面板（V1.55）</div>
            <div><kbd>?</kbd> → 显示本帮助</div>
            <div><kbd>Esc</kbd> → 关闭弹窗/Menu/抽屉</div>
          </div>
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            💡 在输入框/可编辑元素内时，所有快捷键自动让位给文本编辑
          </div>
        </div>
      </Modal>
    </Layout>
  );
}