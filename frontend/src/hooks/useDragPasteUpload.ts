/**
 * V1.52 通用拖拽 + 粘贴上传 hook — 复用 GlobalAIAssistant 的实现
 *
 * 提供：
 *   - dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop }
 *   - pasteHandler:  onPaste
 *   - isDragOver:    是否正在拖拽
 *   - uploadFiles:   手动处理 FileList（用于 input[type=file] 选择）
 *
 * 配置：
 *   - mode: 'image-only' (评论场景：仅接受图片) | 'all' (AI场景：图片+文档+代码)
 *   - maxImageSize / maxFileSize: 字节
 *   - onFiles: (files: File[]) => void   回调交给调用方处理
 *
 * 通用后端：
 *   - 图片：FileReader.readAsDataURL → dataUrl
 *   - 文件：POST /api/upload/file → { type, dataUrl, content }
 */
import { useState, useRef, useCallback, DragEvent, ClipboardEvent } from 'react';

export interface UseDragPasteUploadOptions {
  /** 仅图片（评论场景）/ 全部（AI 场景） */
  mode?: 'image-only' | 'all';
  /** 图片大小上限（默认 10MB） */
  maxImageSize?: number;
  /** 文件大小上限（默认 50MB） */
  maxFileSize?: number;
  /** 接受的文件类型白名单（扩展名），默认全接收 */
  accept?: string[];
  /** 拒绝时回调 */
  onError?: (msg: string) => void;
  /** 接收到合法文件时回调（不直接处理，交给调用方） */
  onFiles?: (files: File[]) => void;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const ALL_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|pdf|docx?|xlsx?|pptx?|txt|md|json|ya?ml|xml|csv|html?|css|scss|sass|less|js|jsx|ts|tsx|vue|py|java|c|cpp|h|hpp|go|rs|rb|php|sh|sql|graphql|vue|svelte)$/i;

function isAccepted(name: string, mode: 'image-only' | 'all'): boolean {
  if (mode === 'image-only') return IMAGE_EXT.test(name);
  return ALL_EXT.test(name);
}

export function useDragPasteUpload(options: UseDragPasteUploadOptions = {}) {
  const {
    mode = 'image-only',
    maxImageSize = 10 * 1024 * 1024,
    maxFileSize = 50 * 1024 * 1024,
    onError,
    onFiles,
  } = options;

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: File[] = [];
    for (const f of Array.from(files)) {
      if (!isAccepted(f.name, mode)) {
        onError?.(`不支持的文件类型: ${f.name}`);
        continue;
      }
      const isImage = IMAGE_EXT.test(f.name);
      const limit = isImage ? maxImageSize : maxFileSize;
      if (f.size > limit) {
        const mb = (limit / 1024 / 1024).toFixed(0);
        onError?.(`文件 ${f.name} 超过 ${mb}MB`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) onFiles?.(valid);
  }, [mode, maxImageSize, maxFileSize, onError, onFiles]);

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  /** 仅在 image-only 模式下处理粘贴（其他模式由 RichEditor 自行处理） */
  const onPaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || mode !== 'image-only') return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const ext = item.type.split('/')[1] || 'png';
          const name = `pasted_${Date.now()}.${ext}`;
          files.push(new File([file], name, { type: item.type }));
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files as any);
    }
  }, [mode, handleFiles]);

  return {
    isDragOver,
    dragHandlers: { onDragEnter, onDragLeave, onDragOver, onDrop },
    pasteHandler: { onPaste },
    uploadFiles: handleFiles,
  };
}
