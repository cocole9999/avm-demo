import { useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  /** 可选：拦截链接点击事件。返回 true 表示已处理（阻止默认跳转），返回 false 走默认行为 */
  onLinkClick?: (href: string, text: string) => boolean;
}

export function MarkdownContent({ content, className, style, onLinkClick }: MarkdownContentProps) {
  const html = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content, { async: false, breaks: true }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLinkClick) return;
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href) return;
    const handled = onLinkClick(href, target.textContent || '');
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [onLinkClick]);

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
