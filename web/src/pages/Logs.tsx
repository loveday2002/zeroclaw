import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Pause,
  Play,
  ArrowDown,
  Filter,
} from 'lucide-react';
import type { SSEEvent } from '@/types/api';
import { SSEClient } from '@/lib/sse';

function formatTimestamp(ts?: string): string {
  if (!ts) return new Date().toLocaleTimeString();
  return new Date(ts).toLocaleTimeString();
}

function eventTypeBadgeColor(type: string): { classes: string; bg: string } {
  switch (type.toLowerCase()) {
    case 'error':
      return { classes: 'text-red-400 border-red-500/20', bg: 'rgba(255,68,102,0.06)' };
    case 'warn':
    case 'warning':
      return { classes: 'text-amber-400 border-amber-500/20', bg: 'rgba(255,170,0,0.06)' };
    case 'tool_call':
    case 'tool_result':
      return { classes: 'text-purple-400 border-purple-500/20', bg: 'rgba(168,85,247,0.06)' };
    case 'message':
    case 'chat':
      return { classes: 'text-blue-500 border-blue-500/20', bg: 'rgba(0,128,255,0.06)' };
    case 'health':
    case 'status':
      return { classes: 'text-emerald-400 border-emerald-500/20', bg: 'rgba(0,230,138,0.06)' };
    default:
      return { classes: 'text-slate-500 border-slate-700', bg: 'rgba(26,26,62,0.3)' };
  }
}

interface LogEntry {
  id: string;
  event: SSEEvent;
}

export default function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<SSEClient | null>(null);
  const pausedRef = useRef(false);
  const entryIdRef = useRef(0);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const client = new SSEClient();

    client.onConnect = () => {
      setConnected(true);
    };

    client.onError = () => {
      setConnected(false);
    };

    client.onEvent = (event: SSEEvent) => {
      if (pausedRef.current) return;
      entryIdRef.current += 1;
      const entry: LogEntry = {
        id: `log-${entryIdRef.current}`,
        event,
      };
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(-500) : next;
      });
    };

    client.connect();
    sseRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  // Detect user scroll to toggle auto-scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  const jumpToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    setAutoScroll(true);
  };

  const allTypes = Array.from(new Set(entries.map((e) => e.event.type))).sort();

  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredEntries =
    typeFilters.size === 0
      ? entries
      : entries.filter((e) => typeFilters.has(e.event.type));

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-default/40 animate-fade-in bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold  uppercase tracking-wider">Live Logs</h2>
          <div className="flex items-center gap-2 ml-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full glow-dot ${connected ? 'text-emerald-400 bg-emerald-400' : 'text-red-500 bg-red-500'
                }`}
            />
            <span className="text-[10px] text-slate-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-[10px] text-slate-600 ml-2 font-mono">
            {filteredEntries.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause/Resume */}
          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${paused
              ? 'text-text-primary shadow-[0_0_15px_rgba(0,230,138,0.2)]'
              : 'text-text-primary shadow-[0_0_15px_rgba(255,170,0,0.2)]'
              }`}
            style={{
              background: paused
                ? 'linear-gradient(135deg, #00e68a, #00cc7a)'
                : 'linear-gradient(135deg, #ffaa00, #ee9900)'
            }}
          >
            {paused ? (
              <>
                <Play className="h-3.5 w-3.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            )}
          </button>

          {/* Jump to Bottom */}
          {!autoScroll && (
            <button
              onClick={jumpToBottom}
              className="btn-electric flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to bottom
            </button>
          )}
        </div>
      </div>

      {/* Event type filters */}
      {allTypes.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border-default/30 overflow-x-auto bg-[var(--bg-input)]">
          <Filter className="h-3.5 w-3.5 text-slate-600 shrink-0" />
          <span className="text-[10px] text-slate-600 shrink-0 uppercase tracking-wider">Filter:</span>
          {allTypes.map((type) => (
            <label
              key={type}
              className="flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <input
                type="checkbox"
                checked={typeFilters.has(type)}
                onChange={() => toggleTypeFilter(type)}
                className="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 h-3 w-3"
              />
              <span className="text-[10px] text-slate-500 capitalize">{type}</span>
            </label>
          ))}
          {typeFilters.size > 0 && (
            <button
              onClick={() => setTypeFilters(new Set())}
              className="text-[10px] text-blue-500 hover:text-cyan-400 shrink-0 ml-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1.5"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 animate-fade-in">
            <Activity className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm">
              {paused
                ? 'Log streaming is paused.'
                : 'Waiting for events...'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const { event } = entry;
            const badge = eventTypeBadgeColor(event.type);
            const detail =
              event.message ??
              event.content ??
              event.data ??
              JSON.stringify(
                Object.fromEntries(
                  Object.entries(event).filter(
                    ([k]) => k !== 'type' && k !== 'timestamp',
                  ),
                ),
              );

            return (
              <div
                key={entry.id}
                className="glass-card rounded-lg p-3 hover:border-blue-500/12 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap mt-0.5">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border capitalize shrink-0 ${badge.classes}`}
                    style={{ background: badge.bg }}
                  >
                    {event.type}
                  </span>
                  <p className="text-sm text-slate-400 break-all min-w-0">
                    {typeof detail === 'string' ? detail : JSON.stringify(detail)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
