/**
 * V1.48 AppBreadcrumb - 根据当前路由自动生成面包屑
 *
 * 支持动态参数：
 *   /work-items/:type → 工作项 / 需求
 *   /work-items/:type/:id → 工作项 / 需求 / #R-001
 *   /reviews/:id → 评审 / #RV-001
 *
 * 用法：
 *   <AppBreadcrumb items={[{ label: '客户', path: '/customers' }, { label: '详情' }]} />
 *
 * 或自动推断（不传 items）：
 *   <AppBreadcrumb />
 */
import { Breadcrumb } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

// 路由路径 → 中文名称映射
const PATH_LABELS: Record<string, string> = {
  workbench: '工作台',
  dashboard: '仪表盘',
  'work-items': '工作项',
  flows: '流程',
  reviews: '评审',
  dashboards: '仪表盘列表',
  charts: '图表',
  ai: 'AI 助理',
  notifications: '通知',
  resources: '资源',
  tree: '树视图',
  fields: '字段配置',
  automation: '自动化',
  analysis: '分析',
  baselines: '基线',
  mcp: 'MCP',
  tests: '测试',
  tenants: '租户管理',
  'llm-settings': '大模型设置',
  customers: '客户',
  'car-models': '车型',
  projects: '项目',
  dependencies: '外部依赖',
  gantt: '甘特图',
  users: '用户',
  'audit-logs': '审计日志',
  imports: '数据导入',
  reports: '报告',
};

// 工作项类型 → 中文
const WORK_ITEM_TYPE_LABELS: Record<string, string> = {
  requirement: '需求',
  task: '任务',
  bug: '缺陷',
  release: '发布',
};

function buildAutoItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: '首页', path: '/workbench' }];

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += '/' + seg;

    // 动态参数（:id/:type）
    if (i === 1 && segments[0] === 'work-items') {
      // /work-items/:type 中的 :type
      items.push({ label: WORK_ITEM_TYPE_LABELS[seg] || seg });
      continue;
    }
    if (i === 2 && segments[0] === 'work-items') {
      // /work-items/:type/:id 中的 :id
      items.push({ label: `#${seg}` });
      continue;
    }
    if (i === 1 && (segments[0] === 'reviews' || segments[0] === 'dashboards' || segments[0] === 'flows' || segments[0] === 'charts')) {
      // 详情页 ID
      items.push({ label: `#${seg}` });
      continue;
    }

    // 静态路径段
    const label = PATH_LABELS[seg] || seg;
    // 最后一个段不设 path（当前页不可点）
    items.push({ label, path: i < segments.length - 1 ? currentPath : undefined });
  }

  return items;
}

interface AppBreadcrumbProps {
  items?: BreadcrumbItem[];
  /** 额外追加到末尾的项（如动态标题） */
  extra?: BreadcrumbItem[];
}

export function AppBreadcrumb({ items, extra }: AppBreadcrumbProps) {
  const location = useLocation();
  const finalItems = useMemo(() => {
    const base = items ?? buildAutoItems(location.pathname);
    return extra ? [...base, ...extra] : base;
  }, [items, extra, location.pathname]);

  return (
    <Breadcrumb
      style={{ marginBottom: 12, fontSize: 13 }}
      items={finalItems.map((item) => ({
        title: item.path ? <Link to={item.path}>{item.label}</Link> : item.label,
      }))}
    />
  );
}
