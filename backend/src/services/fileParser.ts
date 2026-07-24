/**
 * 文件解析服务 (V1.45)
 *
 * 支持的文件类型和大小限制（参照豆包）：
 * - 图片：PNG/JPG/JPEG/GIF/WEBP/BMP/SVG (≤10MB)
 * - 文档：PDF/DOCX/XLSX/PPTX/TXT/MD/JSON/CSV (≤50MB)
 * - 代码：JS/TS/PY/Java/C/C++/Go/Rust 等 (≤5MB)
 *
 * 解析策略：
 * - 文本文件：直接读取内容
 * - 图片：转 base64 dataUrl
 * - PDF：提取文本内容
 * - DOCX：提取文本内容
 * - XLSX：提取前 100 行数据
 * - PPTX：提取幻灯片文本
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// pdf-parse v2: CJS module, exports PDFParse class
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

// ============================================================
// 文件类型定义
// ============================================================

export interface ParsedFile {
  name: string;
  type: 'image' | 'document' | 'code' | 'binary';
  mimeType: string;
  size: number;
  content?: string;      // 文本内容
  dataUrl?: string;      // 图片 base64
  summary?: string;      // 文件摘要（前 200 字符）
  metadata?: any;        // 元数据（页数、行数等）
}

// ============================================================
// 文件类型检测
// ============================================================

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs',
  'html', 'htm', 'css', 'scss', 'less', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'sh', 'bash', 'zsh', 'bat', 'ps1', 'cmd',
  'sql', 'graphql', 'prisma',
  'csv', 'tsv', 'log',
  'vue', 'svelte', 'astro',
  'gitignore', 'dockerignore', 'editorconfig', 'eslintrc', 'prettierrc',
]);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'pptx']);

const MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', json: 'application/json',
  js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python',
  java: 'text/x-java', html: 'text/html', css: 'text/css',
  xml: 'application/xml', csv: 'text/csv',
};

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getFileType(filename: string): 'image' | 'document' | 'code' | 'binary' {
  const ext = getFileExtension(filename);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (TEXT_EXTENSIONS.has(ext)) return 'code';
  return 'binary';
}

export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================================
// 文件大小限制
// ============================================================

const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10MB
  document: 50 * 1024 * 1024,   // 50MB（对齐豆包免费用户）
  code: 20 * 1024 * 1024,       // 20MB（对齐豆包）
  binary: 50 * 1024 * 1024,     // 50MB
};

export function checkFileSize(filename: string, size: number): { ok: boolean; error?: string } {
  const type = getFileType(filename);
  const limit = SIZE_LIMITS[type];
  if (size > limit) {
    return { ok: false, error: `文件 ${filename} 超过大小限制 (${formatSize(limit)})` };
  }
  return { ok: true };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ============================================================
// 文件读取
// ============================================================

function readFileAsText(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return fs.promises.readFile(filePath);
}

function readFileAsDataUrl(filePath: string, mimeType: string): Promise<string> {
  return readFileAsBuffer(filePath).then(buf => {
    return `data:${mimeType};base64,${buf.toString('base64')}`;
  });
}

// ============================================================
// 文件解析
// ============================================================

export async function parseFile(filePath: string, filename: string): Promise<ParsedFile> {
  const type = getFileType(filename);
  const mimeType = getMimeType(filename);
  const stat = await fs.promises.stat(filePath);
  const size = stat.size;

  const result: ParsedFile = {
    name: filename,
    type,
    mimeType,
    size,
  };

  try {
    if (type === 'image') {
      result.dataUrl = await readFileAsDataUrl(filePath, mimeType);
      result.summary = `[图片: ${filename} (${formatSize(size)})]`;
    } else if (type === 'document') {
      const ext = getFileExtension(filename);
      if (ext === 'pdf') {
        const buffer = await readFileAsBuffer(filePath);
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        await parser.load();
        const textResult = await parser.getText();
        const info = await parser.getInfo();
        // getText() 返回 { pages: [{text, num}], text: "全量文本", total: N }
        result.content = textResult?.text || '';
        result.metadata = { pages: textResult?.total || 0, info: info?.info || info };
        result.summary = (result.content || '').slice(0, 200);
        await parser.destroy();
      } else if (ext === 'docx') {
        const buffer = await readFileAsBuffer(filePath);
        const data = await mammoth.extractRawText({ buffer });
        result.content = data.value || '';
        result.summary = result.content.slice(0, 200);
      } else if (ext === 'xlsx') {
        const buffer = await readFileAsBuffer(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames.slice(0, 5)) {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          sheets.push(`## ${sheetName}\n${json.slice(0, 100).map((row: any) => (Array.isArray(row) ? row.join('\t') : String(row))).join('\n')}`);
        }
        result.content = sheets.join('\n\n');
        result.metadata = { sheets: workbook.SheetNames.length, sheetNames: workbook.SheetNames.slice(0, 10) };
        result.summary = `Excel 文件 (${workbook.SheetNames.length} 个工作表)`;
      } else if (ext === 'pptx') {
        // PPTX 解析需要额外库，暂时返回提示
        result.content = `[PPTX 文件: ${filename}，暂不支持文本提取，请手动查看]`;
        result.summary = `[PPTX: ${filename} (${formatSize(size)})]`;
      }
    } else if (type === 'code') {
      result.content = await readFileAsText(filePath);
      // 限制内容长度（避免超出 LLM 上下文）
      if (result.content.length > 50000) {
        result.content = result.content.slice(0, 50000) + '\n\n[... 内容已截断，文件过大 ...]';
      }
      result.summary = result.content.slice(0, 200);
    } else {
      result.content = `[二进制文件: ${filename} (${formatSize(size)})，无法直接读取文本内容]`;
      result.summary = result.content;
    }
  } catch (e: any) {
    result.content = `[文件解析失败: ${e.message}]`;
    result.summary = result.content;
  }

  return result;
}

// ============================================================
// 临时文件管理
// ============================================================

const UPLOAD_DIR = path.join(os.tmpdir(), 'avm-uploads');

export async function ensureUploadDir(): Promise<string> {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

export async function saveUploadedFile(buffer: Buffer, filename: string): Promise<string> {
  const dir = await ensureUploadDir();
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${filename}`;
  const filePath = path.join(dir, uniqueName);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export async function cleanupUploadedFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // 忽略删除失败
  }
}

// 定期清理临时文件（超过 1 小时）
export async function cleanupOldFiles(): Promise<number> {
  const dir = await ensureUploadDir();
  const files = await fs.promises.readdir(dir);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    if (now - stat.mtimeMs > oneHour) {
      await fs.promises.unlink(filePath);
      cleaned++;
    }
  }

  return cleaned;
}

// 启动时清理一次
cleanupOldFiles().catch(() => {});
