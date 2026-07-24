/**
 * AVM Wiki 知识加载器
 * - 把仓库 /wiki 目录的 MD 内容拼成一个结构化文本
 * - 与 projectSnapshot 一起喂给 LLM，让 LLM 掌握 AVM 全部知识
 * - 5 分钟缓存（与 projectSnapshot 对齐）
 */
import fs from 'node:fs';
import path from 'node:path';

let _cache: { text: string; ts: number } | null = null;
const TTL = 5 * 60_000;

// 优先找仓库根 wiki（与 avm-demo 平级）；找不到再找 avm-demo/../wiki
function resolveWikiDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'wiki'),
    path.resolve(process.cwd(), '..', 'wiki'),
    path.resolve(process.cwd(), 'wiki'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  return null;
}

function extractSummary(md: string, max = 600): string {
  // 去除 frontmatter
  const noFront = md.replace(/^---[\s\S]*?---\s*/m, '');
  // 去除 ## 关联连接 之后
  const cut = noFront.split('## 关联连接')[0];
  // 去除 markdown 标记
  const text = cut
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[.*?\]\]/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export interface WikiKnowledge {
  text: string;
  pageCount: number;
  chars: number;
}

export function loadWikiKnowledge(): WikiKnowledge {
  if (_cache && Date.now() - _cache.ts < TTL) {
    return { text: _cache.text, pageCount: 0, chars: _cache.text.length };
  }
  const dir = resolveWikiDir();
  if (!dir) {
    const fallback = '【AVM Wiki】未找到 wiki 目录；请将仓库根的 wiki/ 与 avm-demo/ 平级放置。';
    _cache = { text: fallback, ts: Date.now() };
    return { text: fallback, pageCount: 0, chars: fallback.length };
  }
  const lines: string[] = [];
  lines.push('【AVM 项目中心 - 知识库摘要】');
  lines.push('以下是 AVM 项目中心的概念、实体、来源摘要与登录账号等基础知识；回答用户问题时优先使用这里的名词与定义。');
  lines.push('');

  const files = walk(dir, dir);
  let pageCount = 0;
  for (const f of files) {
    const base = path.basename(f, '.md');
    // 跳过 index / log
    if (base === 'index' || base === 'log') continue;
    const content = fs.readFileSync(f, 'utf-8');
    const summary = extractSummary(content, 500);
    if (!summary) continue;
    const titleMatch = content.match(/^title:\s*"?([^"\n]+)"?/m);
    const typeMatch = content.match(/^type:\s*(\S+)/m);
    const title = titleMatch ? titleMatch[1] : base;
    const type = typeMatch ? typeMatch[1] : 'note';
    lines.push(`### ${title}（${type}）`);
    lines.push(summary);
    lines.push('');
    pageCount += 1;
  }
  lines.push('【Wiki 摘要结束】');
  const text = lines.join('\n');
  _cache = { text, ts: Date.now() };
  return { text, pageCount, chars: text.length };
}

function walk(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out.sort();
}
