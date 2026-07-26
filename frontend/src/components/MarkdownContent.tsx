import { useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { linkifyWorkItemKeys, parseWorkItemHref, workItemLinkPath } from '../utils/workItemLinker';
import { useNavigate } from 'react-router-dom';

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /** 可选：拦截链接点击事件。返回 true 表示已处理（阻止默认跳转），返回 false 走默认行为 */
  onLinkClick?: (href: string, text: string) => boolean;
}

export function MarkdownContent({ content, className, style, onLinkClick }: MarkdownContentProps) {
  const navigate = useNavigate();

  const html = useMemo(() => {
    if (!content) return '';
    // V1.50: 在 marked 解析前先 linkify 工作项编号（marked 默认保留 inline HTML）
    const linked = linkifyWorkItemKeys(content);
    const raw = marked.parse(linked, { async: false, breaks: true, gfm: true }) as string;
    // V1.55.x: DOMPurify 默认会过滤掉自定义协议（如 avm-wi://），导致 href 被清空。
    // 这里扩展 ALLOWED_URI_REGEXP 允许 avm-wi 协议通过，并保留 data-wi-key / data-href 兜底属性。
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['data-wi-key', 'data-href', 'target', 'rel'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|avm-wi):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    // V1.55.x: 优先用 href；若 href 被清洗兜底用 data-wi-key / data-href
    const href = target.getAttribute('href') || target.getAttribute('data-href') || '';
    const wiKey = target.getAttribute('data-wi-key') || '';

    // 兜底：即使 href 已被 DOMPurify 清空，也能通过 data-wi-key 跳转到工作项详情页
    if (!href && wiKey) {
      e.preventDefault();
      e.stopPropagation();
      const path = workItemLinkPath(wiKey);
      if (path) navigate(path);
      return;
    }
    if (!href) return;

    // V1.50: 拦截工作项链接，跳转到详情页
    const wi = parseWorkItemHref(href);
    if (wi) {
      e.preventDefault();
      e.stopPropagation();
      const path = workItemLinkPath(wi.key);
      if (path) navigate(path);
      return;
    }

    if (onLinkClick) {
      const handled = onLinkClick(href, target.textContent || '');
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // 默认行为：外部链接新窗口打开
    if (/^https?:\/\//.test(href)) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }, [onLinkClick, navigate]);

  return (
    <div
      className={`avm-markdown ${className || ''}`}
      style={{
        lineHeight: 1.6,
        wordBreak: 'break-word',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
