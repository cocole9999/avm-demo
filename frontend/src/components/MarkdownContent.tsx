import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

const markdownStyle = `
  .avm-markdown h1, .avm-markdown h2, .avm-markdown h3, .avm-markdown h4 { margin: 12px 0 6px; font-weight: 600; }
  .avm-markdown h1 { font-size: 18px; }
  .avm-markdown h2 { font-size: 16px; }
  .avm-markdown h3 { font-size: 14px; }
  .avm-markdown p { margin: 4px 0; }
  .avm-markdown ul, .avm-markdown ol { margin: 4px 0; padding-left: 20px; }
  .avm-markdown li { margin: 2px 0; }
  .avm-markdown table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
  .avm-markdown th, .avm-markdown td { border: 1px solid #d9d9d9; padding: 6px 8px; text-align: left; }
  .avm-markdown th { background: #f5f5f5; font-weight: 600; }
  .avm-markdown code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 12px; }
  .avm-markdown pre { background: #f6f8fa; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
  .avm-markdown pre code { background: transparent; padding: 0; }
  .avm-markdown blockquote { margin: 6px 0; padding-left: 10px; border-left: 3px solid #d9d9d9; color: #666; }
  .avm-markdown hr { border: none; border-top: 1px solid #e8e8e8; margin: 10px 0; }
  .avm-markdown strong { font-weight: 600; }
`;

export function MarkdownContent({ content, className, style }: MarkdownContentProps) {
  const html = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content, { async: false, breaks: true }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <>
      <style>{markdownStyle}</style>
      <div
        className={`avm-markdown ${className || ''}`}
        style={{
          lineHeight: 1.6,
          wordBreak: 'break-word',
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
