import { useState } from 'react';
import { Plus, Trash2, MessageSquare, Search } from 'lucide-react';
import type { Session } from '@/types/session';

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

/** 按时间分组 */
function groupByDate(sessions: Session[]): { label: string; items: Session[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 7 * 86_400_000;

  const today: Session[] = [];
  const yesterday: Session[] = [];
  const last7Days: Session[] = [];
  const older: Session[] = [];

  for (const s of sessions) {
    const t = new Date(s.updated_at).getTime();
    if (t >= todayStart) {
      today.push(s);
    } else if (t >= yesterdayStart) {
      yesterday.push(s);
    } else if (t >= weekStart) {
      last7Days.push(s);
    } else {
      older.push(s);
    }
  }

  const result: { label: string; items: Session[] }[] = [];
  if (today.length > 0) result.push({ label: 'Today', items: today });
  if (yesterday.length > 0) result.push({ label: 'Yesterday', items: yesterday });
  if (last7Days.length > 0) result.push({ label: 'Last 7 days', items: last7Days });
  if (older.length > 0) result.push({ label: 'Older', items: older });

  return result;
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: SessionSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;
  const groups = groupByDate(filtered);

  return (
    <div
      className="flex flex-col h-full w-[260px] shrink-0 border-r"
      style={{
        borderColor: 'var(--border-default)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border hover:border-blue-500/25 hover:bg-blue-500/6"
          style={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)',
            background: 'transparent',
          }}
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-blue-500/25"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--border-default)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No sessions yet</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {group.label}
            </p>
            {group.items.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-all duration-200 mb-0.5 border-l-2 ${isActive
                      ? 'text-white border-blue-500'
                      : 'hover:bg-[#1a1a3e]/40 border-transparent'
                    }`}
                  style={
                    isActive
                      ? { background: 'rgba(0,128,255,0.1)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span className="flex-1 truncate text-xs">{session.title}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/12 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
