import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, AlertCircle, Copy, Check, PanelLeftClose, PanelLeft, Moon, Sun } from 'lucide-react';
import type { WsMessage } from '@/types/api';
import type { SessionMessage } from '@/types/session';
import { WebSocketClient } from '@/lib/ws';
import { generateUUID } from '@/lib/uuid';
import { useDraft } from '@/hooks/useDraft';
import { useSessionManager } from '@/hooks/useSessionManager';
import SessionSidebar from '@/components/SessionSidebar';

const DRAFT_KEY = 'agent-chat';
const THEME_KEY = 'zeroclaw_theme';

export default function AgentChat() {
  const { draft, saveDraft, clearDraft } = useDraft(DRAFT_KEY);
  const {
    sessions,
    activeSession,
    activeSessionId,
    startNewSession,
    switchSession,
    goHome,
    addMessage,
    deleteSession,
  } = useSessionManager();

  const [input, setInput] = useState(draft);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);

  const wsRef = useRef<WebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingContentRef = useRef('');

  // Refs to track current session ids inside WebSocket callback closures
  const activeSessionIdRef = useRef<string | null>(null);
  const pendingSessionIdRef = useRef<string | null>(null);
  // Flag: when true, the next 'message'/'done' from backend is a /new response → discard it
  const awaitingNewAckRef = useRef(false);

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Persist draft
  useEffect(() => {
    saveDraft(input);
  }, [input, saveDraft]);

  // WebSocket setup — runs once on mount
  useEffect(() => {
    const ws = new WebSocketClient();

    ws.onOpen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onClose = () => {
      setConnected(false);
    };

    ws.onError = () => {
      setError('Connection error. Attempting to reconnect...');
    };

    const getTargetSessionId = (): string | null =>
      activeSessionIdRef.current ?? pendingSessionIdRef.current;

    const pushMessage = (msg: Omit<SessionMessage, 'id' | 'timestamp'>) => {
      const targetId = getTargetSessionId();
      if (!targetId) return;
      addMessage(targetId, {
        ...msg,
        id: generateUUID(),
        timestamp: new Date().toISOString(),
      });
    };

    ws.onMessage = (msg: WsMessage) => {
      switch (msg.type) {
        case 'chunk':
          setTyping(true);
          pendingContentRef.current += msg.content ?? '';
          break;

        case 'message':
        case 'done': {
          const content = msg.full_response ?? msg.content ?? pendingContentRef.current;
          pendingContentRef.current = '';
          setTyping(false);

          // If we're waiting for the /new acknowledgment, discard this response
          if (awaitingNewAckRef.current) {
            awaitingNewAckRef.current = false;
            break;
          }

          if (content) {
            pushMessage({ role: 'agent', content });
          }
          pendingSessionIdRef.current = null;
          break;
        }

        case 'tool_call':
          pushMessage({
            role: 'agent',
            content: `[Tool Call] ${msg.name ?? 'unknown'}(${JSON.stringify(msg.args ?? {})})`,
            toolCall: { name: msg.name ?? 'unknown', args: msg.args ?? {} },
          });
          break;

        case 'tool_result':
          pushMessage({
            role: 'agent',
            content: `[Tool Result] ${msg.output ?? ''}`,
          });
          break;

        case 'error':
          pushMessage({
            role: 'agent',
            content: `[Error] ${msg.message ?? 'Unknown error'}`,
          });
          setTyping(false);
          pendingContentRef.current = '';
          break;
      }
    };

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
    // addMessage is stable (useCallback with stable deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll when messages change or typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, typing]);

  // ---- Send logic ----

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current?.connected) return;

    let sessionId = activeSessionId;

    // New conversation: create session + send /new to clear context window
    if (!sessionId) {
      sessionId = startNewSession(trimmed);
      pendingSessionIdRef.current = sessionId;

      try {
        awaitingNewAckRef.current = true;
        wsRef.current.sendMessage('/new');
      } catch {
        setError('Failed to clear context. Please try again.');
        awaitingNewAckRef.current = false;
        return;
      }

      // Brief delay to let backend process /new before the real message
      await new Promise((r) => setTimeout(r, 300));
    }

    // Add user message to session store
    addMessage(sessionId, {
      id: generateUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    });

    // Send to backend via WebSocket
    try {
      wsRef.current.sendMessage(trimmed);
      setTyping(true);
      pendingContentRef.current = '';
    } catch {
      setError('Failed to send message. Please try again.');
    }

    setInput('');
    clearDraft();
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  }, [input, activeSessionId, startNewSession, addMessage, clearDraft]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleCopy = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId((prev) => (prev === msgId ? null : prev)), 2000);
    });
  }, []);

  const currentMessages = activeSession?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Session sidebar (collapsible) */}
      <div
        className={`transition-all duration-300 overflow-hidden shrink-0 ${sidebarOpen ? 'w-[260px]' : 'w-0'
          }`}
      >
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={switchSession}
          onNewChat={goHome}
          onDeleteSession={deleteSession}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar: sidebar toggle + session title + theme toggle */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
            {activeSession && (
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{activeSession.title}</span>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-all hover:scale-105"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Connection error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-500/8 border-red-500/20 border-b flex items-center gap-2 text-sm text-red-400 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome page — no active session */}
          {!activeSession && (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 animate-float"
                style={{ background: isDark ? 'linear-gradient(135deg, rgba(0,128,255,0.08), rgba(0,128,255,0.03))' : 'linear-gradient(135deg, rgba(0,128,255,0.1), rgba(0,128,255,0.05))' }}
              >
                <Bot className="h-8 w-8" style={{ color: 'var(--accent-blue)' }} />
              </div>
              <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>ZeroClaw Agent</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Send a message to start a new conversation</p>
            </div>
          )}

          {/* Active session with no messages yet (edge case during creation) */}
          {activeSession && currentMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
              <Bot className="h-8 w-8 mb-2" style={{ color: 'var(--accent-blue)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Send a message to start the conversation</p>
            </div>
          )}

          {/* Render messages */}
          {currentMessages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`group flex items-start gap-3 ${msg.role === 'user'
                  ? 'flex-row-reverse animate-slide-in-right'
                  : 'animate-slide-in-left'
                }`}
              style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
            >
              <div
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    msg.role === 'user'
                      ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-blue-hover))'
                      : isDark
                        ? 'linear-gradient(135deg, rgba(26,26,62), rgba(18,18,42))'
                        : 'linear-gradient(135deg, rgba(200,200,220,0.3), rgba(180,180,200,0.2))',
                }}
              >
                {msg.role === 'user' ? (
                  <User className="h-4 w-4" style={{ color: msg.role === 'user' ? '#fff' : 'var(--accent-blue)' }} />
                ) : (
                  <Bot className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
                )}
              </div>
              <div className="relative max-w-[75%]">
                <div
                  className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'text-white' : ''
                    }`}
                  style={{
                    background:
                      msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-blue-hover))'
                        : isDark
                          ? 'linear-gradient(135deg, rgba(13,13,32,0.8), rgba(10,10,26,0.6))'
                          : 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,249,250,0.95))',
                    border: msg.role !== 'user' && !isDark ? '1px solid var(--border-default)' : undefined,
                    color: msg.role !== 'user' ? 'var(--text-primary)' : undefined,
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/50' : ''
                      }`}
                    style={{ color: msg.role !== 'user' ? 'var(--text-muted)' : undefined }}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  aria-label="Copy message"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-lg text-slate-500 hover:text-white hover:border-blue-500/25"
                  style={{
                    background: isDark ? 'var(--bg-input)' : 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  {copiedId === msg.id ? (
                    <Check className="h-3 w-3" style={{ color: 'var(--status-success)' }} />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(26,26,62), rgba(18,18,42))'
                    : 'linear-gradient(135deg, rgba(200,200,220,0.3), rgba(180,180,200,0.2))',
                }}
              >
                <Bot className="h-4 w-4" style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(13,13,32,0.8), rgba(10,10,26,0.6))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,249,250,0.95))',
                  border: isDark ? '1px solid var(--border-default)' : '1px solid var(--border-default)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-blue)', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-blue)', animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-blue)', animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-4" style={{ borderColor: 'var(--border-default)', background: isDark ? 'linear-gradient(180deg, rgba(8,8,24,0.9), rgba(5,5,16,0.95))' : 'var(--bg-secondary)' }}>
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={connected ? 'Type a message...' : 'Connecting...'}
                disabled={!connected}
                className="input-electric w-full px-4 py-3 text-sm resize-none overflow-y-auto disabled:opacity-40"
                style={{ minHeight: '44px', maxHeight: '200px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!connected || !input.trim()}
              className="btn-electric shrink-0 p-3 rounded-xl"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-center mt-2 gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full glow-dot ${connected ? 'text-emerald-400 bg-emerald-400' : 'text-red-500 bg-red-500'
                }`}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
