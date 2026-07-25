/**
 * V1.53: 自然语言搜索工具（从 aiCommand.ts 提取）
 * 基于规则的关键词解析 → 筛选条件 → 页面 URL
 */
import { tokenize, jaccardSimilarity } from './textSimilarity';

export interface NlSearchResult {
  target: string;
  filters: Record<string, any>;
  humanReadable: string;
  url: string;
}

/** 基于规则的关键词解析（不依赖 LLM） */
export function ruleBasedNlSearch(q: string): NlSearchResult {
  const filters: any = {};
  let target: 'workitem' | 'project' | 'customer' = 'workitem';
  if (/项目/.test(q)) target = 'project';
  if (/客户/.test(q)) target = 'customer';

  // 优先级
  const pm = q.match(/P([0-3])/i);
  if (pm) filters.priority = `P${pm[1].toUpperCase()}`;
  if (/紧急|最重要|高优/.test(q)) filters.priority = 'P0';

  // 类型
  if (/需求/.test(q)) filters.type = 'requirement';
  if (/缺陷|bug|Bug/.test(q)) filters.type = 'bug';
  if (/任务/.test(q)) filters.type = 'task';
  if (/发布|版本|release/i.test(q)) filters.type = 'release';

  // 时间
  if (/今天/.test(q)) filters.createdWithinDays = 1;
  else if (/昨天/.test(q)) filters.createdWithinDays = 2;
  else if (/本周|这周/.test(q)) filters.createdWithinDays = 7;
  else if (/上周/.test(q)) filters.createdWithinDays = 14;
  else if (/本月/.test(q)) filters.createdWithinDays = 30;
  else if (/本季度/.test(q)) filters.createdWithinDays = 90;
  const daysMatch = q.match(/最近\s*(\d+)\s*[天日]/);
  if (daysMatch) filters.createdWithinDays = Math.min(parseInt(daysMatch[1], 10), 365);

  // 延期/超期
  if (/延期|超期|逾期/.test(q)) filters.overdue = true;

  // 阻塞
  if (/阻塞|卡住|等待/.test(q)) filters.status = '阻塞';

  // assignee
  if (/我的|我负责|我接/.test(q)) filters.assignee = 'me';
  if (/我创建的|我提的/.test(q)) filters.reporter = 'me';

  // 提取人员名（粗略：中文字符 2-4 个）
  const personMatch = q.match(/^([\u4e00-\u9fa5]{2,4})(的|负责|完成|的)/);
  if (personMatch && !/我/.test(personMatch[1])) {
    filters.assignee = personMatch[1];
  }

  // 关键词搜索
  const keywordMatch = q.match(/[「"'"](.+?)[」"'"]/);
  if (keywordMatch) filters.keyword = keywordMatch[1];

  return {
    target,
    filters,
    humanReadable: `规则解析: ${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join(', ') || '无筛选'}`,
    url: buildSearchUrl(target, filters),
  };
}

/** 把 filters 拼到对应目标页的 URL */
export function buildSearchUrl(target: string, filters: any): string {
  const params = new URLSearchParams();
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.assignee) params.set('assignee', filters.assignee);
  if (filters.reporter) params.set('reporter', filters.reporter);
  if (filters.projectCode) params.set('projectCode', filters.projectCode);
  if (filters.customerCode) params.set('customerCode', filters.customerCode);
  if (filters.label) params.set('label', filters.label);
  if (filters.createdWithinDays) params.set('withinDays', String(filters.createdWithinDays));
  if (filters.completedWithinDays) params.set('completedWithinDays', String(filters.completedWithinDays));
  if (filters.overdue) params.set('overdue', '1');
  if (filters.keyword) params.set('q', filters.keyword);

  if (target === 'project') return `/projects?${params.toString()}`;
  if (target === 'customer') return `/customers?${params.toString()}`;
  return `/workitems?${params.toString()}`;
}

/** 导出 textSimilarity 供外部使用（tokenize + jaccardSimilarity） */
export { tokenize, jaccardSimilarity };