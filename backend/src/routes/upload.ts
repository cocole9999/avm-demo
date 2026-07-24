/**
 * 文件上传路由 (V1.45)
 *
 * POST /api/upload/file    - 上传文件并解析
 * POST /api/upload/image   - 上传图片（返回 dataUrl）
 * GET  /api/upload/types   - 获取支持的文件类型和限制
 */
import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import {
  parseFile, checkFileSize, getFileType, getMimeType,
  saveUploadedFile, cleanupUploadedFile, formatSize,
} from '../services/fileParser';

export const fileUploadRouter = Router();
fileUploadRouter.use(requireAuth);

// 获取支持的文件类型和限制（对齐豆包）
fileUploadRouter.get('/types', (_req, res) => {
  res.json({
    image: {
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
      maxSize: formatSize(10 * 1024 * 1024),
      maxSizeBytes: 10 * 1024 * 1024,
    },
    document: {
      extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md', 'json', 'csv'],
      maxSize: formatSize(100 * 1024 * 1024),
      maxSizeBytes: 100 * 1024 * 1024,
    },
    code: {
      extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'html', 'css', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bat'],
      maxSize: formatSize(20 * 1024 * 1024),
      maxSizeBytes: 20 * 1024 * 1024,
    },
    maxAttachments: 10,
  });
});

// 上传文件（通用）
fileUploadRouter.post('/file', async (req: AuthedRequest, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ error: 'filename 和 content (base64) 必填' });
    }

    // 检查文件大小
    const buffer = Buffer.from(content, 'base64');
    const sizeCheck = checkFileSize(filename, buffer.length);
    if (!sizeCheck.ok) {
      return res.status(413).json({ error: sizeCheck.error });
    }

    // 保存临时文件
    const filePath = await saveUploadedFile(buffer, filename);

    // 解析文件
    const parsed = await parseFile(filePath, filename);

    // 清理临时文件（图片保留 dataUrl，其他保留 content）
    if (parsed.type !== 'image') {
      await cleanupUploadedFile(filePath);
    }

    res.json(parsed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 上传图片（专门处理，返回 dataUrl）
fileUploadRouter.post('/image', async (req: AuthedRequest, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ error: 'filename 和 content (base64) 必填' });
    }

    const buffer = Buffer.from(content, 'base64');
    const sizeCheck = checkFileSize(filename, buffer.length);
    if (!sizeCheck.ok) {
      return res.status(413).json({ error: sizeCheck.error });
    }

    const mimeType = getMimeType(filename);
    const dataUrl = `data:${mimeType};base64,${content}`;

    res.json({
      name: filename,
      type: 'image',
      mimeType,
      size: buffer.length,
      dataUrl,
      summary: `[图片: ${filename} (${formatSize(buffer.length)})]`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
