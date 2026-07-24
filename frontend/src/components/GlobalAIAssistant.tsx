/**
 * GlobalAIAssistant - 全局 AI 助手组件 (V1.41 多模态输入+模型下拉+语音修复)
 *
 * 跨页面可用：
 * - 右下角悬浮按钮（点击唤起）
 * - Ctrl+K / Cmd+K 唤起
 * - 支持自然语言命令（LLM 调工具完成实际操作）
 * - 多轮对话记忆（sessionStorage 持久化 + 后端 history 注入）
 * - 多模态输入：文件内容读取/图片base64、语音实时转写、模型跨厂商选择
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { FloatButton, Drawer, Input, Button, Space, Tag, Spin, message as antdMessage, Avatar, Empty, Tooltip, Popconfirm, Badge, Select, Divider } from 'antd';
import {
  RobotOutlined, SendOutlined, CloseOutlined, ThunderboltOutlined, ClearOutlined, HistoryOutlined,
  AudioOutlined, AudioMutedOutlined, PictureOutlined, FileOutlined, PlusOutlined,
  StopOutlined, CaretDownOutlined, DeleteOutlined, SettingOutlined, CheckOutlined, LockOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import { llmApi, llmSettingsApi } from '../api';
import { MarkdownContent } from './MarkdownContent';
import { SlashCommandMenu, type CommandResult } from './SlashCommandMenu';

const { TextArea } = Input;

// 文本文件扩展名白名单（可以直接读取内容传给 LLM）
const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs',
  'html', 'htm', 'css', 'scss', 'less', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'sh', 'bash', 'zsh', 'bat', 'ps1', 'cmd',
  'sql', 'graphql', 'prisma',
  'csv', 'tsv', 'log',
  'vue', 'svelte', 'astro',
  'gitignore', 'dockerignore', 'editorconfig', 'eslintrc', 'prettierrc',
]);

interface Attachment {
  name: string;
  type: 'file' | 'image';
  content?: string;
  dataUrl?: string;
  size: number;
  loading?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  attachments?: Attachment[];
  toolCalls?: { name: string; args: any; result?: any; error?: string; id?: string }[];
  toolCallsRaw?: any[];
  toolResults?: { tool_call_id: string; content: string }[];
  actions?: { label: string; command: string; args?: Record<string, any> }[];
  time: string;
  pending?: boolean;
}

interface HistoryMsg {
  role: 'user' | 'assistant' | 'tool';
  content?: string | any[];
  tool_calls?: any[];
  tool_call_id?: string;
}

interface ProviderMeta {
  key: string;
  name: string;
  logo?: string;
  capabilities?: { vision?: boolean; file?: boolean };
  models: string[];
  defaultModel?: string;
}

const API = '/api/ai-command';
const STORAGE_KEY = (user: string) => `avm.ai.history.${user}`;
const MAX_HISTORY = 30;
const MAX_CONTEXT = 12;
const MAX_TEXT_FILE_SIZE = 20 * 1024 * 1024; // 代码文件 20MB（对齐豆包）
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 图片 10MB
const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 文档文件 50MB（对齐豆包）

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function loadHistory(user: string): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(user));
    if (!raw) return [];
    const arr = JSON.parse(raw) as Message[];
    return Array.isArray(arr) ? arr.slice(-MAX_HISTORY) : [];
  } catch { return []; }
}

function saveHistory(user: string, msgs: Message[]) {
  try { sessionStorage.setItem(STORAGE_KEY(user), JSON.stringify(msgs.slice(-MAX_HISTORY))); } catch { /* ignore */ }
}

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function isImageFile(filename: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 语音输入 Hook - V1.41：支持实时转写 interimResults
function useSpeechRecognition(onInterim: (text: string) => void, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!isSupported) {
      antdMessage.warning('当前浏览器不支持语音输入，请使用 Chrome/Edge 最新版');
      return;
    }
    try {
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      finalTextRef.current = '';
      setInterimText('');

      rec.onresult = (e: any) => {
        let interim = '';
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }
        if (interim) {
          setInterimText(interim);
          onInterim(interim);
        }
        if (finalText) {
          finalTextRef.current += finalText;
          setInterimText('');
        }
      };
      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          antdMessage.error(`语音识别失败: ${e.error}`);
        }
        setListening(false);
        setInterimText('');
      };
      rec.onend = () => {
        if (finalTextRef.current) {
          onFinal(finalTextRef.current);
        }
        setListening(false);
        setInterimText('');
      };
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err: any) {
      antdMessage.error(`无法启动语音识别: ${err.message}`);
    }
  }, [isSupported, onInterim, onFinal]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  return { listening, interimText, start, stop, isSupported };
}

export function GlobalAIAssistant() {
  const { user } = useAuth();
  const username = user?.displayName || user?.username || 'guest';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadHistory(username);
    if (saved.length > 0) return saved;
    return [{
      id: genId(), role: 'ai',
      content: '你好！我是 AVM 全局 AI 助理。支持上传文件/图片、语音输入，你可以用自然语言告诉我做什么，比如"分析这个需求文档"、"这张图里有什么问题"、"创建一个 P0 需求"。',
      time: new Date().toLocaleTimeString('zh-CN'),
    }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [deepThinking, setDeepThinking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<any>(null);

  // V1.44 / 命令菜单状态
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });

  // V1.45 拖拽上传状态
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  // 检测 / 触发命令菜单
  const handleInputChange = (val: string) => {
    setInput(val);
    // 检测是否刚输入 /
    if (val.endsWith('/') && !slashMenuVisible) {
      const textarea = textAreaRef.current?.resizableTextArea?.textArea;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        setSlashMenuPos({ top: rect.top - 320, left: rect.left });
      } else {
        setSlashMenuPos({ top: window.innerHeight - 380, left: window.innerWidth - 620 });
      }
      setSlashMenuVisible(true);
      setSlashQuery('');
    } else if (slashMenuVisible) {
      // 在菜单打开时，提取 / 后面的文本作为搜索
      const slashIdx = val.lastIndexOf('/');
      if (slashIdx >= 0) {
        setSlashQuery(val.slice(slashIdx + 1));
      } else {
        setSlashMenuVisible(false);
      }
    }
  };

  // 执行 / 命令
  const executeSlashCommand = async (command: string, args: Record<string, any>) => {
    setInput('');
    setSlashMenuVisible(false);

    const userMsg: Message = {
      id: genId(), role: 'user',
      content: `/${command} ${Object.entries(args).map(([k, v]) => `${k}=${v}`).join(' ')}`,
      time: new Date().toLocaleTimeString('zh-CN'),
    };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    try {
      const r = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args }),
      });
      const result: CommandResult = await r.json();

      const aiMsg: Message = {
        id: genId(), role: 'ai',
        content: result.ok
          ? `### ${result.title}\n\n${result.content}`
          : `❌ **${result.title}**\n\n${result.content}`,
        actions: result.actions || undefined,
        time: new Date().toLocaleTimeString('zh-CN'),
      };
      setMessages(m => [...m, aiMsg]);

      if (result.ok) {
        window.dispatchEvent(new CustomEvent('avm-data-changed'));
      }
    } catch (e: any) {
      setMessages(m => [...m, { id: genId(), role: 'ai', content: `❌ 命令执行失败: ${e.message}`, time: new Date().toLocaleTimeString('zh-CN') }]);
    } finally {
      setLoading(false);
    }
  };

  // LLM 状态
  const [llmStatus, setLlmStatus] = useState<any>(null);
  const [allProviders, setAllProviders] = useState<ProviderMeta[]>([]);
  const [activeProviderKeys, setActiveProviderKeys] = useState<Set<string>>(new Set());
  const [allProviderModels, setAllProviderModels] = useState<Record<string, string[]>>({});
  const [switchingModel, setSwitchingModel] = useState(false);

  const currentProviderKey = llmStatus?.provider || '';
  const currentModel = llmStatus?.model || '';
  const currentProvider = allProviders.find(p => p.key === currentProviderKey);
  const supportsVision = currentProvider?.capabilities?.vision || false;

  const refreshLlm = async () => {
    try {
      const r: any = await llmSettingsApi.list();
      const st = r?.status || null;
      setLlmStatus(st);
      const providers: ProviderMeta[] = (r?.providers || []).map((p: any) => ({
        key: p.key, name: p.name, logo: p.logo, capabilities: p.capabilities,
        models: p.models || [], defaultModel: p.defaultModel,
      }));
      setAllProviders(providers);
      const activeKeys = new Set<string>((r?.activeProviders || []).map((p: any) => p.key));
      setActiveProviderKeys(activeKeys);
      // 加载所有已配置厂商的模型列表（activeProviders 即为已配置的）
      const modelMap: Record<string, string[]> = {};
      const configuredKeys = Array.from(activeKeys);
      await Promise.all(configuredKeys.map(async (pk) => {
        try {
          const m: any = await llmSettingsApi.listModels(pk);
          modelMap[pk] = m?.builtinAll || m?.all || m?.builtin || providers.find(p => p.key === pk)?.models || [];
        } catch {
          modelMap[pk] = providers.find(p => p.key === pk)?.models || [];
        }
      }));
      setAllProviderModels(modelMap);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (open) refreshLlm();
    const handler = () => refreshLlm();
    window.addEventListener('llm-status-updated', handler);
    return () => window.removeEventListener('llm-status-updated', handler);
  }, [open]);

  // 切换模型（可跨厂商）
  const switchModel = async (providerKey: string, model: string) => {
    if (!providerKey || !model) return;
    const isActive = activeProviderKeys.has(providerKey);
    if (!isActive) {
      antdMessage.warning(`厂商 ${providerKey} 尚未配置 API Key，请先在 LLM 设置页配置`);
      window.open('/llm-settings', '_blank');
      return;
    }
    setSwitchingModel(true);
    try {
      // 如果切换的是不同厂商，先激活厂商
      if (providerKey !== currentProviderKey) {
        await llmSettingsApi.activateProvider(providerKey);
      }
      // 切换模型
      const r: any = await llmSettingsApi.quickSwitch(providerKey, model);
      antdMessage.success(`已切换到 ${model}`);
      await refreshLlm();
    } catch (e: any) { antdMessage.error(e.message); }
    finally { setSwitchingModel(false); }
  };

  useEffect(() => { saveHistory(username, messages); }, [messages, username]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      fetch(API + '/suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: window.location.pathname }),
      }).then(r => r.json()).then(d => setSuggestions(d.suggestions || [])).catch(() => setSuggestions([]));
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  // 文件处理 (V1.45: 文档类文件走后端解析)
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newAtts: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (isImageFile(f.name)) {
        if (f.size > MAX_IMAGE_SIZE) {
          antdMessage.error(`图片 ${f.name} 超过 10MB`); continue;
        }
        const att: Attachment = { name: f.name, type: 'image', size: f.size, loading: true };
        try { att.dataUrl = await readFileAsDataUrl(f); } catch { antdMessage.error(`读取图片失败: ${f.name}`); continue; }
        att.loading = false;
        newAtts.push(att);
      } else {
        // 文档/代码文件：上传到后端解析
        const att = await uploadAndParseFile(f);
        newAtts.push(att);
      }
    }
    setAttachments(prev => [...prev, ...newAtts]);
  };

  const handleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newAtts: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!isImageFile(f.name)) continue;
      if (f.size > MAX_IMAGE_SIZE) { antdMessage.error(`图片 ${f.name} 超过 10MB`); continue; }
      const att: Attachment = { name: f.name, type: 'image', size: f.size, loading: true };
      try { att.dataUrl = await readFileAsDataUrl(f); } catch { antdMessage.error(`读取图片失败: ${f.name}`); continue; }
      att.loading = false;
      newAtts.push(att);
    }
    setAttachments(prev => [...prev, ...newAtts]);
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  // V1.45 拖拽上传处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  // V1.45 剪贴板粘贴图片
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const name = `pasted_${Date.now()}.${item.type.split('/')[1] || 'png'}`;
          const dt = new DataTransfer();
          dt.items.add(new File([file], name, { type: item.type }));
          handleImages(dt.files);
        }
      }
    }
  }, []);

  // V1.45 Markdown 链接拦截：将命令链接转为执行命令
  const handleLinkClick = useCallback((href: string, text: string): boolean => {
    // 匹配 /命令名 格式（如 /risk-scan, /weekly-report）
    const match = href.match(/^\/([a-z0-9-]+)$/);
    if (match) {
      const command = match[1];
      executeSlashCommand(command, {});
      return true;
    }
    return false;
  }, []);

  // V1.45 上传文件到后端解析
  const uploadAndParseFile = async (file: File): Promise<Attachment> => {
    const att: Attachment = { name: file.name, type: 'file', size: file.size, loading: true };
    try {
      const buffer = await file.arrayBuffer();
      // 分块转 base64，避免大文件调用栈溢出
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);
      // 使用 llmApi 自动带认证 token，避免 401/500 错误
      const r = await llmApi.post('/upload/file', { filename: file.name, content: base64 });
      const parsed = r.data;
      att.type = parsed.type === 'image' ? 'image' : 'file';
      att.dataUrl = parsed.dataUrl;
      att.content = parsed.content;
      att.loading = false;
      return att;
    } catch (e: any) {
      att.loading = false;
      att.content = `[上传失败: ${e.message}]`;
      antdMessage.error(`文件上传失败: ${file.name} - ${e.message}`);
      return att;
    }
  };

  // 语音输入
  const baseInputRef = useRef(input);
  useEffect(() => { baseInputRef.current = input; }, [input]);

  const { listening, interimText, start: startVoice, stop: stopVoice, isSupported: voiceSupported } =
    useSpeechRecognition(
      (interim) => { /* 实时转写时，在输入框显示灰色提示（通过value拼接） */ },
      (finalText) => { setInput(prev => (prev ? prev.trim() + ' ' : '') + finalText); }
    );

  const stopGenerating = () => {
    abortController?.abort(); setLoading(false); setAbortController(null);
  };

  const buildContextMsgs = (msgs: Message[]): HistoryMsg[] => {
    const out: HistoryMsg[] = [];
    for (const m of msgs.slice(-MAX_CONTEXT)) {
      if (m.role === 'user') {
        let content: string = m.content;
        if (m.attachments?.length) {
          content = m.attachments.map(a => {
            if (a.type === 'image') return `[图片: ${a.name}]`;
            if (a.content) return `[文件: ${a.name}]\n${a.content.slice(0, 5000)}`;
            return `[文件: ${a.name}]`;
          }).join('\n') + '\n' + content;
        }
        out.push({ role: 'user', content });
      } else if (m.role === 'ai') {
        out.push({
          role: 'assistant', content: m.content,
          ...(m.toolCallsRaw && m.toolCallsRaw.length > 0 ? { tool_calls: m.toolCallsRaw } : {}),
        });
        if (m.toolResults?.length) {
          for (const tr of m.toolResults) out.push({ role: 'tool', tool_call_id: tr.tool_call_id, content: tr.content });
        }
      }
    }
    return out;
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q && attachments.length === 0) return;
    if (listening) stopVoice();
    const userMsg: Message = {
      id: genId(), role: 'user', content: q,
      attachments: attachments.length > 0 ? attachments.map(a => ({ ...a })) : undefined,
      time: new Date().toLocaleTimeString('zh-CN'),
    };
    setInput(''); setAttachments([]);
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    const historyPayload = buildContextMsgs(messages);
    const controller = new AbortController();
    setAbortController(controller);

    // 构造发送给后端的附件数据（图片传 dataUrl，文件传 content）
    const payloadAttachments = userMsg.attachments?.map(a => ({
      name: a.name, type: a.type, content: a.content, dataUrl: a.dataUrl, size: a.size,
    }));

    try {
      const r = await llmApi.post('/ai-command/command',
        { command: q, history: historyPayload, attachments: payloadAttachments, deepThinking },
        { signal: controller.signal }
      ).then(r => r.data);
      if (r.error) throw new Error(r.error);
      const rawToolCalls = (r.toolCalls || []).filter((tc: any) => tc.id).map((tc: any) => ({
        id: tc.id, type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
      }));
      const toolResults = (r.toolCalls || []).filter((tc: any) => tc.id).map((tc: any) => ({
        tool_call_id: tc.id,
        content: tc.error ? `错误: ${tc.error}` : (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2).slice(0, 4000)),
      }));
      const aiMsg: Message = {
        id: genId(), role: 'ai',
        content: r.reply || '（AI 没返回内容）',
        toolCalls: r.toolCalls || [],
        toolCallsRaw: rawToolCalls.length > 0 ? rawToolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        time: new Date().toLocaleTimeString('zh-CN'),
      };
      setMessages(m => [...m, aiMsg]);
      const created = (r.toolCalls || []).some((tc: any) =>
        (tc.name === 'create_work_item' || tc.name === 'update_work_item') && !tc.error
      );
      if (created) {
        window.dispatchEvent(new CustomEvent('avm-data-changed'));
        antdMessage.success('已自动刷新相关页面');
      }
    } catch (e: any) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') { /* 用户停止 */ }
      else {
        setMessages(m => [...m, { id: genId(), role: 'ai', content: `❌ ${e.message}`, time: new Date().toLocaleTimeString('zh-CN') }]);
      }
    } finally {
      setLoading(false); setAbortController(null);
    }
  };

  const clearHistory = () => {
    setMessages([{
      id: genId(), role: 'ai',
      content: '对话已清空。有什么新任务尽管说～支持上传文件/图片、语音输入。',
      time: new Date().toLocaleTimeString('zh-CN'),
    }]);
    setAttachments([]);
    antdMessage.success('对话已清空');
  };

  const messageCount = messages.filter(m => m.role === 'user').length;
  const hasConfiguredLlm = llmStatus?.configured;
  const providerLogo = currentProvider?.logo || '🔘';

  // 构建模型下拉选项（按厂商分组）
  const modelDropdownItems = useMemoModelDropdown(allProviders, activeProviderKeys, allProviderModels, currentProviderKey, currentModel, switchModel);

  return (
    <>
      <Badge count={messageCount} size="small" offset={[-8, 8]} color="#722ed1">
        <FloatButton
          type="primary"
          icon={<span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>AI</span>}
          tooltip="AI 助理 (Ctrl+K)"
          style={{ right: 24, bottom: 24, width: 56, height: 56 }}
          onClick={() => setOpen(true)}
          aria-label="打开 AI 助理"
        />
      </Badge>

      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#1677ff' }} />
            <span>AVM 全局 AI 助理</span>
            <Tag color="purple" style={{ marginLeft: 8 }}>Ctrl+K</Tag>
            {messageCount > 1 && <Tag color="cyan" icon={<HistoryOutlined />}>已聊 {messageCount} 轮</Tag>}
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={580}
        closeIcon={<CloseOutlined />}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 55px)' } }}
        extra={
          <Popconfirm title="清空对话历史？" description="当前会话的所有消息会被清掉（不影响他人）" okText="清空" cancelText="取消" onConfirm={clearHistory}>
            <Button size="small" icon={<ClearOutlined />}>新会话</Button>
          </Popconfirm>
        }
        footer={null}
      >
        {/* V1.45 拖拽上传容器 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
        >
        {/* V1.45 拖拽上传遮罩 */}
        {dragOver && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(22, 119, 255, 0.08)', border: '2px dashed #1677ff',
              borderRadius: 8, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ textAlign: 'center', color: '#1677ff' }}>
              <FileOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 500 }}>拖拽文件到此处上传</div>
              <div style={{ fontSize: 12, marginTop: 4, color: '#999' }}>支持图片、PDF、Word、Excel、代码文件等</div>
            </div>
          </div>
        )}
        {/* 快捷建议 */}
        {messages.filter(m => m.role === 'user').length === 0 && suggestions.length > 0 && (
          <div style={{ padding: 12, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              <ThunderboltOutlined style={{ color: '#fa8c16' }} /> 你可以试试
            </div>
            <Space wrap size={[8, 8]}>
              {suggestions.map((s, i) => (<Tag key={i} style={{ cursor: 'pointer' }} onClick={() => send(s)} color="blue">{s}</Tag>))}
            </Space>
          </div>
        )}

        {/* 消息流 */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.length === 0 && <Empty description="开始对话" />}
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 16, display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <Avatar
                icon={m.role === 'user' ? '👤' : <RobotOutlined />}
                style={{ background: m.role === 'user' ? '#1677ff' : '#722ed1', flexShrink: 0 }}
              />
              <div style={{
                maxWidth: '85%', background: m.role === 'user' ? '#1677ff' : '#fafafa',
                color: m.role === 'user' ? '#fff' : '#333',
                padding: '8px 12px', borderRadius: 8, fontSize: 13, wordBreak: 'break-word',
              }}>
                {m.attachments && m.attachments.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.attachments.map((a, ai) => a.type === 'image' && a.dataUrl ? (
                      <img key={ai} src={a.dataUrl} alt={a.name} style={{ maxWidth: 180, maxHeight: 180, borderRadius: 6, objectFit: 'cover' }} />
                    ) : (
                      <Tag key={ai} icon={<FileOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: m.role === 'user' ? '#fff' : '#333', border: 'none' }}>
                        {a.name} ({formatSize(a.size)})
                      </Tag>
                    ))}
                  </div>
                )}
                {m.role === 'user' ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                ) : (
                  <MarkdownContent content={m.content} onLinkClick={handleLinkClick} />
                )}
                {m.actions && m.actions.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.actions.map((a, ai) => (
                      <span
                        key={ai}
                        onClick={() => executeSlashCommand(a.command, a.args || {})}
                        style={{
                          fontSize: 12, color: '#1677ff', cursor: 'pointer',
                          padding: '2px 10px', borderRadius: 12,
                          border: '1px solid #1677ff', background: '#f0f5ff',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = '#1677ff'; (e.target as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = '#f0f5ff'; (e.target as HTMLElement).style.color = '#1677ff'; }}
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d9b3ff' }}>
                    <div style={{ fontSize: 11, color: '#722ed1', marginBottom: 4 }}>🔧 工具调用：</div>
                    {m.toolCalls.map((tc, j) => (
                      <div key={j} style={{ fontSize: 11, color: tc.error ? '#cf1322' : '#389e0d', marginBottom: 2 }}>
                        {tc.error ? '❌' : '✓'} <code style={{ fontSize: 10 }}>{tc.name}</code>
                        {tc.error ? `: ${tc.error}` : tc.result?.key ? ` → ${tc.result.key}` : tc.result?.ok ? ' → ok' : ''}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>{m.time}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin tip="AI 思考中..."><div style={{ minHeight: 60 }} /></Spin>
            </div>
          )}
        </div>

        {/* 底部输入区 */}
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 12px 12px', background: '#fff' }}>
          {/* 附件预览 */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '6px 8px', background: '#f5f5f5', borderRadius: 8 }}>
              {attachments.map((a, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff', borderRadius: 6, border: '1px solid #e8e8e8', fontSize: 12 }}>
                  {a.loading ? <Spin size="small" /> :
                    a.type === 'image' && a.dataUrl ? (
                      <img src={a.dataUrl} alt={a.name} style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (<FileOutlined style={{ color: '#1677ff' }} />)
                  }
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <span style={{ fontSize: 10, color: '#999' }}>{formatSize(a.size)}{a.content ? ' · 已读取' : ''}</span>
                  </div>
                  {!a.loading && <DeleteOutlined style={{ color: '#999', cursor: 'pointer', fontSize: 11 }} onClick={() => removeAttachment(i)} />}
                </div>
              ))}
            </div>
          )}

          {/* 语音实时转写提示 */}
          {listening && interimText && (
            <div style={{ padding: '4px 8px', marginBottom: 4, background: '#e6f7ff', borderRadius: 6, fontSize: 12, color: '#1677ff' }}>
              🎤 {interimText}
            </div>
          )}

          <div style={{
            border: listening ? '2px solid #1677ff' : '1.5px solid #e5e7eb',
            borderRadius: 18, padding: '8px 10px 4px', background: '#fff',
            transition: 'border-color 0.2s',
            boxShadow: listening ? '0 0 0 3px rgba(22,119,255,0.1)' : 'none',
          }}>
            <TextArea
              ref={textAreaRef}
              value={listening ? (input + (interimText ? ' ' + interimText : '')) : input}
              onChange={e => { if (!listening) handleInputChange(e.target.value); }}
              onPaste={handlePaste}
              placeholder="帮你编写代码、调试 Bug、优化性能等开发工作，交付生产级代码产物。"
              autoSize={{ minRows: 1, maxRows: 6 }}
              disabled={loading}
              variant="borderless"
              style={{ padding: '4px 8px', fontSize: 14, resize: 'none', background: 'transparent', boxShadow: 'none', color: listening ? '#999' : undefined }}
              onPressEnter={(e) => { if (!e.shiftKey && !listening) { e.preventDefault(); send(); } }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0' }}>
              <Space size={2} align="center">
                <Tooltip title="添加附件">
                  <Button type="text" size="small"
                    icon={<span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>/</span>}
                    style={{ width: 32, height: 32, borderRadius: '50%', color: '#666' }}
                    onClick={() => setInput(prev => prev + '/')}
                  />
                </Tooltip>

                <Tooltip title={supportsVision ? '上传图片' : '当前模型不支持图片识别，请切换视觉模型'}>
                  <Button type="text" size="small" icon={<PictureOutlined />}
                    style={{ width: 32, height: 32, borderRadius: '50%', color: supportsVision ? '#666' : '#d9d9d9' }}
                    disabled={!supportsVision}
                    onClick={() => imageInputRef.current?.click()}
                  />
                </Tooltip>

                <Tooltip title="上传文件">
                  <Button type="text" size="small"
                    style={{ width: 36, height: 32, borderRadius: 16, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 0, color: '#666' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{providerLogo}</span>
                    <PlusOutlined style={{ fontSize: 10, marginLeft: -2 }} />
                  </Button>
                </Tooltip>

                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp,image/svg+xml" multiple style={{ display: 'none' }}
                  onChange={e => { handleImages(e.target.files); e.target.value = ''; }} />
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.html,.css,.sql,.xml,.yaml,.yml,.sh,.bat,.log" multiple style={{ display: 'none' }}
                  onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
              </Space>

              <Space size={2} align="center">
                <Tooltip title={deepThinking ? '深度思考已开启（慢但准）' : '深度思考'}>
                  <Button type="text" size="small"
                    icon={<ThunderboltOutlined style={{ color: deepThinking ? '#10b981' : '#999', fontSize: 16 }} />}
                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                    onClick={() => setDeepThinking(!deepThinking)}
                  />
                </Tooltip>

                {/* 模型选择下拉 */}
                {hasConfiguredLlm ? (
                  <Select
                    size="small"
                    value={`${currentProviderKey}::${currentModel}`}
                    loading={switchingModel}
                    onChange={(val) => { const [pk, m] = val.split('::'); switchModel(pk, m); }}
                    variant="borderless"
                    style={{ minWidth: 140, fontSize: 13, fontWeight: 500, color: '#333' }}
                    suffixIcon={<CaretDownOutlined style={{ fontSize: 10, color: '#999' }} />}
                    options={modelDropdownItems}
                    styles={{ popup: { root: { minWidth: 240, maxHeight: 400, overflowY: 'auto' } } }}
                    optionLabelProp="label"
                  />
                ) : (
                  <Button type="link" size="small" onClick={() => window.open('/llm-settings', '_blank')} style={{ fontSize: 12, padding: '0 4px' }}>
                    <SettingOutlined /> 配置模型
                  </Button>
                )}

                {/* 语音输入 */}
                {voiceSupported && (
                  <Tooltip title={listening ? '点击停止（说完后自动转文字）' : '语音输入'}>
                    <Button type="text" size="small"
                      icon={listening
                        ? <AudioMutedOutlined style={{ color: '#f5222d', fontSize: 18 }} />
                        : <AudioOutlined style={{ color: '#666' }} />
                      }
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: listening ? '#fff1f0' : undefined,
                        animation: listening ? 'pulse 1.5s infinite' : undefined,
                      }}
                      onClick={listening ? stopVoice : startVoice}
                    />
                  </Tooltip>
                )}

                {/* 发送/停止 */}
                {loading ? (
                  <Tooltip title="停止生成">
                    <Button type="primary" size="small" danger shape="circle" icon={<StopOutlined />}
                      style={{ width: 36, height: 36 }} onClick={stopGenerating}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="发送（Enter）">
                    <Button type="primary" size="small" shape="circle" icon={<SendOutlined />}
                      style={{ width: 36, height: 36, background: (input.trim() || attachments.length > 0) ? '#4f46e5' : '#c7c9d1' }}
                      onClick={() => send()} disabled={!input.trim() && attachments.length === 0}
                    />
                  </Tooltip>
                )}
              </Space>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 6 }}>
            AI 生成内容仅供参考，请核实关键信息 · 支持拖拽/粘贴/上传文件图片 · Shift+Enter 换行
          </div>
        </div>
        </div>
      </Drawer>

      {/* V1.44 / 命令菜单 */}
      <SlashCommandMenu
        visible={slashMenuVisible}
        query={slashQuery}
        position={slashMenuPos}
        onSelect={executeSlashCommand}
        onClose={() => { setSlashMenuVisible(false); setSlashQuery(''); }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,34,45,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(245,34,45,0); }
        }
      `}</style>
    </>
  );
}

// 构建模型下拉选项（按厂商分组）
function useMemoModelDropdown(
  providers: ProviderMeta[],
  activeKeys: Set<string>,
  modelMap: Record<string, string[]>,
  currentProvider: string,
  currentModel: string,
  switchModel: (pk: string, m: string) => void,
) {
  // Auto Mode 选项
  const options: any[] = [{
    value: '__auto__',
    label: 'Auto Mode',
    disabled: true,
  }];

  // 按已配置厂商排序
  const sorted = [...providers].sort((a, b) => {
    const aActive = activeKeys.has(a.key);
    const bActive = activeKeys.has(b.key);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });

  for (const p of sorted) {
    const isActive = activeKeys.has(p.key);
    const models = modelMap[p.key] || p.models || [];
    if (models.length === 0 && !isActive) continue;

    options.push({
      value: `__group_${p.key}__`,
      label: (
        <span style={{ fontSize: 11, color: '#999', padding: '4px 0', userSelect: 'none' }}>
          {p.logo} {p.name}{!isActive && ' (未配置)'}
        </span>
      ),
      disabled: true,
    });

    for (const m of models) {
      const isSelected = p.key === currentProvider && m === currentModel;
      const disabled = !isActive;
      options.push({
        value: `${p.key}::${m}`,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
            <Space size={6}>
              <span style={{ fontSize: 14 }}>{p.logo}</span>
              <span>{m}</span>
            </Space>
            {isSelected ? <CheckOutlined style={{ color: '#4f46e5', fontSize: 12 }} /> :
              (!isActive ? <LockOutlined style={{ color: '#d9d9d9', fontSize: 12 }} /> : null)}
          </div>
        ),
        disabled,
      });
    }
  }

  // 添加模型按钮（分隔线+按钮）
  options.push({
    value: '__divider__',
    label: <Divider style={{ margin: '4px 0' }} />,
    disabled: true,
  });
  options.push({
    value: '__add_model__',
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1677ff', padding: '4px 0' }}
        onClick={(e) => { e.stopPropagation(); window.open('/llm-settings', '_blank'); }}
      >
        <SettingOutlined />
        <span>添加模型</span>
      </div>
    ),
    disabled: true,
  });

  return options;
}
