/**
 * V1.55 useAgentChat — Agent 聊天 hook
 *
 * 职责：
 *   - 维护 messages 状态
 *   - sendMessage 调后端 /api/ai-command（注入 systemPrompt + allowedTools）
 *   - 处理流式/非流式响应（当前后端为非流式，UI 端可显示加载状态）
 *   - 提供 abort 控制
 *   - 自动持久化到 AgentSession（云端）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentSessionsApi, type Agent, type AgentSession } from '../api';
import { llmApi } from '../api';
import { extractApiError } from '../utils/apiError';
import { useAuth } from '../AuthContext';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  time: string;
  pending?: boolean;
  error?: boolean;
  toolCalls?: { name: string; args: any; result?: any; error?: string }[];
}

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseAgentChatOptions {
  agent: Agent | null;
  sessionId: string | null;
  onSessionCreated?: (session: AgentSession) => void;
  pageContext?: Record<string, any>;
}

export function useAgentChat(options: UseAgentChatOptions) {
  const { agent, sessionId, onSessionCreated, pageContext } = options;
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(sessionId);
  // V1.55.8: 标记刚由 ensureSession 创建的 session，避免 useEffect 覆盖正在发送的消息
  const justCreatedSessionRef = useRef(false);

  // V1.55.4: sessionId 变化时加载该会话历史
  useEffect(() => {
    currentSessionIdRef.current = sessionId;
    // V1.55.8: 如果 session 是由 ensureSession 刚创建的，跳过加载（避免空 session 覆盖正在发送的消息）
    if (justCreatedSessionRef.current) {
      justCreatedSessionRef.current = false;
      return;
    }
    if (sessionId) {
      agentSessionsApi.get(sessionId)
        .then(s => {
          setMessages((s.messages || []).map((m: any) => ({
            id: m.id || genId(),
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '',
            time: m.time ? new Date(m.time).toLocaleTimeString('zh-CN') : '',
            toolCalls: m.toolCalls,
          })));
        })
        .catch(e => {
          console.warn('[useAgentChat] 加载会话历史失败:', e);
          setMessages([]);
        });
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const ensureSession = useCallback(async (firstUserMessage: string): Promise<string> => {
    if (currentSessionIdRef.current) return currentSessionIdRef.current;
    if (!agent) throw new Error('未选择 Agent');
    const s = await agentSessionsApi.create({
      agentId: agent.id,
      title: firstUserMessage.slice(0, 30) || '新会话',
      messages: [],
      metadata: { agentKey: agent.key, page: pageContext },
    });
    currentSessionIdRef.current = s.id;
    // V1.55.8: 标记为刚创建，让 useEffect 跳过加载
    justCreatedSessionRef.current = true;
    onSessionCreated?.(s);
    return s.id;
  }, [agent, onSessionCreated, pageContext]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !agent || loading) return;
    const userMsg: ChatMessage = {
      id: genId(), role: 'user', content: text,
      time: new Date().toLocaleTimeString('zh-CN'),
    };
    const aiMsgId = genId();
    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'ai', content: '', pending: true, time: new Date().toLocaleTimeString('zh-CN') }]);
    setLoading(true);
    setStreaming('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. 确保有 session
      const sid = await ensureSession(text);

      // 2. 构造历史（最近 20 条）
      const historyPayload = [...messages, userMsg].slice(-20).map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: m.content,
      }));

      // 3. 注入 Agent 的 systemPrompt
      const sysPrompt = (agent.systemPrompt || '')
        .replace(/\{\{user\}\}/g, user?.displayName || '匿名')
        .replace(/\{\{page\}\}/g, (pageContext?.pathname as string) || '/')
        .replace(/\{\{pageName\}\}/g, (pageContext?.pageName as string) || '首页')
        .replace(/\{\{context\}\}/g, JSON.stringify(pageContext || {}))
        .replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));

      // 4. 调后端
      const r: any = await llmApi.post('/ai-command/command', {
        command: text,
        history: historyPayload,
        context: pageContext,
        systemPrompt: sysPrompt,
        allowedTools: agent.allowedTools || [],
      }, { signal: controller.signal }).then(r => r.data);

      if (r.error) throw new Error(r.error);

      // 5. 追加到消息列表
      setMessages(prev => prev.map(m => m.id === aiMsgId
        ? { ...m, content: r.reply || '（AI 没返回内容）', pending: false, toolCalls: r.toolCalls }
        : m
      ));

      // 6. 持久化到会话（追加 user + ai 两条）
      try {
        await agentSessionsApi.append(sid, userMsg, undefined);
        await agentSessionsApi.append(sid, {
          id: aiMsgId, role: 'ai', content: r.reply || '',
          time: new Date().toISOString(),
          toolCalls: r.toolCalls,
        }, undefined);
      } catch (e) {
        // 持久化失败不影响 UI
        console.warn('[useAgentChat] 持久化会话失败:', e);
      }
    } catch (e: any) {
      const errMsg = extractApiError(e) || '未知错误';
      const isAbort = e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED';
      setMessages(prev => prev.map(m => m.id === aiMsgId
        ? { ...m, content: isAbort ? '⏹ 已停止' : `❌ ${errMsg}`, pending: false, error: !isAbort }
        : m
      ));
    } finally {
      setLoading(false);
      setStreaming('');
      abortRef.current = null;
    }
  }, [agent, loading, messages, pageContext, ensureSession, user]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    currentSessionIdRef.current = null;
  }, []);

  const loadSession = useCallback((s: AgentSession) => {
    currentSessionIdRef.current = s.id;
    setMessages((s.messages || []).map((m: any) => ({
      id: m.id || genId(),
      role: m.role,
      content: m.content,
      time: m.time ? new Date(m.time).toLocaleTimeString('zh-CN') : '',
      toolCalls: m.toolCalls,
    })));
  }, []);

  return {
    messages,
    loading,
    streaming,
    sendMessage,
    abort,
    clear,
    loadSession,
  };
}
