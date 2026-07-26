// V1.55.17: 验证 MarkdownContent 渲染管道中工作项链接的可跳转性
// 复现 linkifyWorkItemKeys → marked → DOMPurify 完整流程，确保最终 HTML
// 仍保留可识别的 href / data-wi-key，能被 handleClick 拦截跳转。
import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  linkifyWorkItemKeys,
  parseWorkItemHref,
  workItemLinkPath,
} from './workItemLinker';

// 复制 MarkdownContent 中的 DOMPurify 配置
const PURIFY_OPTS = {
  ADD_ATTR: ['data-wi-key', 'data-href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|avm-wi):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

function renderMarkdownLike(content: string): string {
  if (!content) return '';
  const linked = linkifyWorkItemKeys(content);
  const raw = marked.parse(linked, { async: false, breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(raw, PURIFY_OPTS);
}

describe('MarkdownContent pipeline (V1.55.17 DOMPurify fix)', () => {
  it('preserves avm-wi:// href after DOMPurify (default config would strip it)', () => {
    const html = renderMarkdownLike('see REQ-4 for details');
    expect(html).toMatch(/href="avm-wi:\/\/REQ-4"/);
    expect(html).toMatch(/data-wi-key="REQ-4"/);
  });

  it('parses preserved href into detail page path', () => {
    const html = renderMarkdownLike('see REQ-4 for details');
    const m = html.match(/href="(avm-wi:\/\/[^"]+)"/);
    expect(m).not.toBeNull();
    const parsed = parseWorkItemHref(m![1]);
    expect(parsed).toEqual({ type: 'requirement', key: 'REQ-4' });
    expect(workItemLinkPath(parsed!.key)).toBe('/work-items/requirement/REQ-4');
  });

  it('handles multiple keys in one message', () => {
    const html = renderMarkdownLike('超期: BUG-1, TASK-5; 即将到期: REQ-4, TASK-6, TASK-4');
    const keys = [...html.matchAll(/data-wi-key="(REQ|TASK|BUG|REL)-(\d+)"/g)].map(m => `${m[1]}-${m[2]}`);
    expect(keys.sort()).toEqual(['BUG-1', 'REQ-4', 'TASK-4', 'TASK-5', 'TASK-6']);
    // 每个都能生成详情页路径
    for (const k of keys) {
      const p = workItemLinkPath(k);
      expect(p).toMatch(new RegExp(`/work-items/(requirement|task|bug|release)/${k}$`));
    }
  });

  it('handles table cells containing work-item keys', () => {
    // 复现用户截图中的 markdown 表格
    const md = `
| 工作项 | 标题 |
| --- | --- |
| BUG-1 | 银河 L7 全景影像受限 |
| TASK-5 | 博越 L 工厂标定现场采图 |
`;
    const html = renderMarkdownLike(md);
    expect(html).toContain('href="avm-wi://BUG-1"');
    expect(html).toContain('href="avm-wi://TASK-5"');
    expect(html).toContain('class="avm-wi-link"');
  });

  it('preserves href even when the protocol is otherwise XSS-risky', () => {
    // 兜底：万一未来 DOMPurify 再次清洗掉 avm-wi://，
    // data-wi-key 仍能让 handleClick 识别跳转。
    const html = renderMarkdownLike('see REQ-4');
    const m = html.match(/<a [^>]*data-wi-key="REQ-4"[^>]*>/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('class="avm-wi-link"');
  });
});
