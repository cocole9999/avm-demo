// V1.50: 工作项编号自动链接渲染
// 在描述/评论中识别 REQ-1 / TASK-42 / BUG-3 / REL-1 格式编号，渲染为可点击的详情页链接

export const WORK_ITEM_KEY_REGEX = /\b(REQ|TASK|BUG|REL)-(\d+)\b/g;

/** 类型缩写 → 路由 type */
export const KEY_PREFIX_TO_TYPE: Record<string, string> = {
  REQ: 'requirement',
  TASK: 'task',
  BUG: 'bug',
  REL: 'release',
};

/** 自定义协议：用于 MarkdownContent / DOMPurify 保留链接 */
export const WORK_ITEM_HREF_PREFIX = 'avm-wi://';

/**
 * 解析 work-item href
 * @returns 工作项类型与 key；若不是工作项链接则返回 null
 */
export function parseWorkItemHref(href: string): { type: string; key: string } | null {
  if (!href) return null;
  if (!href.startsWith(WORK_ITEM_HREF_PREFIX)) return null;
  const key = href.slice(WORK_ITEM_HREF_PREFIX.length).trim();
  const m = key.match(/^(REQ|TASK|BUG|REL)-(\d+)$/);
  if (!m) return null;
  return { type: KEY_PREFIX_TO_TYPE[m[1]], key };
}

/**
 * 构造 work-item 链接 href
 */
export function buildWorkItemHref(key: string): string {
  return `${WORK_ITEM_HREF_PREFIX}${key}`;
}

/**
 * 构造工作项详情页路由
 */
export function workItemLinkPath(key: string): string | null {
  const m = key.match(/^(REQ|TASK|BUG|REL)-(\d+)$/);
  if (!m) return null;
  const type = KEY_PREFIX_TO_TYPE[m[1]];
  return `/work-items/${type}/${m[1]}-${m[2]}`;
}

export interface LinkifyOptions {
  /** 自定义 className，默认为 'avm-wi-link' */
  className?: string;
  /** 额外属性模板（如 data-* 注入） */
  extraAttrs?: string;
}

/**
 * 将文本中的工作项编号替换为 HTML <a> 链接
 *
 * 跳过位置：
 *  - 已在 markdown 链接/图片中：[*...*](...) 与 ![...](...) 内的 key
 *  - 已在行内代码 `...` 中
 *  - 已在 HTML 标签属性内（粗略判断：左右紧邻 = ' " < 字符）
 *
 * 注意：返回的字符串包含 <a> 标签，必须经 DOMPurify 清洗后再注入 HTML。
 * 由于 marked 默认会保留 inline HTML，本函数适合作为 marked.parse 前的预处理。
 */
export function linkifyWorkItemKeys(text: string, options: LinkifyOptions = {}): string {
  if (!text) return text;
  const cls = options.className || 'avm-wi-link';
  const extra = options.extraAttrs || '';

  // 1. 提取并保护需要跳过的区段
  //    跳过：markdown 图片/链接 [text](url)、行内代码 `code`、已有 <a ...>...</a>
  const skipRanges: Array<[number, number]> = [];

  // 行内代码 `...`
  const codeRe = /`[^`\n]*`/g;
  let cm: RegExpExecArray | null;
  while ((cm = codeRe.exec(text))) {
    skipRanges.push([cm.index, cm.index + cm[0].length]);
  }

  // markdown 链接/图片 [text](url)
  const linkRe = /!?\[[^\]]*\]\([^)\s]*(?:\s+["'][^"']*["'])?\)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(text))) {
    skipRanges.push([lm.index, lm.index + lm[0].length]);
  }

  // 已有 <a ...>...</a>（粗略匹配，<a>...</a>）
  const aRe = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = aRe.exec(text))) {
    skipRanges.push([am.index, am.index + am[0].length]);
  }

  // 2. 在不在 skip 范围内的位置替换 key
  const inSkip = (idx: number, len: number) => {
    const end = idx + len;
    return skipRanges.some(([s, e]) => idx < e && end > s);
  };

  return text.replace(WORK_ITEM_KEY_REGEX, (match, prefix, num, offset) => {
    if (inSkip(offset, match.length)) return match;
    // 检查前后是否为 HTML 属性字符：= ' " < 这些位置应跳过
    const before = offset > 0 ? text[offset - 1] : '';
    if (before === '"' || before === "'" || before === '=' || before === '<') return match;
    const key = `${prefix}-${num}`;
    return `<a href="${buildWorkItemHref(key)}" class="${cls}" data-wi-key="${key}"${extra ? ' ' + extra : ''}>${key}</a>`;
  });
}

/**
 * 提取文本中所有工作项 key（去重保序）
 */
export function extractWorkItemKeys(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(WORK_ITEM_KEY_REGEX.source, 'g');
  while ((m = re.exec(text))) {
    const k = `${m[1]}-${m[2]}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
