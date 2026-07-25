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
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['data-wi-key', 'target', 'rel'],
    });
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    const href = target.getAttribute('href');
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
