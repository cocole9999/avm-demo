/**
 * V1.53: 文本相似度工具（从 aiCommand.ts 提取）
 * 中文分词 + Jaccard 相似度计算
 */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '你', '他', '她', '它', '这', '那',
  '和', '与', '及', '或', '但', '而', '所以', '因为', '一个', '一些',
  '一种', '这个', '那个', '为', '为了', '从', '到', '向', '上', '下',
  '里', '外', '内', '中', '以', '被', '把', '让', '使', '通过',
]);

/** 简单中文分词（按字符 + 标点切分，过滤停用词，2-gram 增强） */
export function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  const cleaned = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ');
  const tokens = new Set<string>();
  for (const word of cleaned.split(/\s+/)) {
    if (!word) continue;
    if (/^[\u4e00-\u9fa5]+$/.test(word)) {
      if (word.length >= 2 && !STOP_WORDS.has(word)) {
        tokens.add(word);
        for (let i = 0; i < word.length - 1; i++) {
          const g = word.slice(i, i + 2);
          if (!STOP_WORDS.has(g)) tokens.add(g);
        }
      }
    } else {
      if (word.length >= 2 && !STOP_WORDS.has(word)) tokens.add(word);
    }
  }
  return tokens;
}

/** Jaccard 相似度 = |A ∩ B| / |A ∪ B| */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}