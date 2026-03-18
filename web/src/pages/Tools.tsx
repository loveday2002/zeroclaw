import { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  ChevronDown,
  ChevronRight,
  Terminal,
  Package,
} from 'lucide-react';
import type { ToolSpec, CliTool } from '@/types/api';
import { getTools, getCliTools } from '@/lib/api';

export default function Tools() {
  const [tools, setTools] = useState<ToolSpec[]>([]);
  const [cliTools, setCliTools] = useState<CliTool[]>([]);
  const [search, setSearch] = useState('');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTools(), getCliTools()])
      .then(([t, c]) => {
        setTools(t);
        setCliTools(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredCli = cliTools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
  );

  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="rounded-xl bg-red-500/8 border-red-500/20 p-4 text-red-400">
          Failed to load tools: {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className="input-electric w-full pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Agent Tools Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold  uppercase tracking-wider">
            Agent Tools ({filtered.length})
          </h2>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-600">No tools match your search.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {filtered.map((tool) => {
              const isExpanded = expandedTool === tool.name;
              return (
                <div
                  key={tool.name}
                  className="glass-card overflow-hidden animate-slide-in-up"
                >
                  <button
                    onClick={() =>
                      setExpandedTool(isExpanded ? null : tool.name)
                    }
                    className="w-full text-left p-4 hover:bg-[#0080ff08] transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <h3 className="text-sm font-semibold text-text-primary truncate">
                          {tool.name}
                        </h3>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-blue-500 shrink-0 transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-600 shrink-0 transition-transform" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {tool.description}
                    </p>
                  </button>

                  {isExpanded && tool.parameters && (
                    <div className="border-t border-slate-700 p-4 animate-fade-in">
                      <p className="text-[10px] text-slate-600 mb-2 font-semibold uppercase tracking-wider">
                        Parameter Schema
                      </p>
                      <pre className="text-xs text-text-secondary rounded-xl p-3 overflow-x-auto max-h-64 overflow-y-auto bg-[var(--bg-input)]">
                        {JSON.stringify(tool.parameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLI Tools Section */}
      {filteredCli.length > 0 && (
        <div className="animate-slide-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-semibold  uppercase tracking-wider">
              CLI Tools ({filteredCli.length})
            </h2>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="table-electric">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Path</th>
                  <th className="text-left">Version</th>
                  <th className="text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredCli.map((tool) => (
                  <tr key={tool.name}>
                    <td className="px-4 py-3 text-text-primary font-medium text-sm">
                      {tool.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs truncate max-w-50">
                      {tool.path}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {tool.version ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize border border-slate-700 text-slate-400 bg-[var(--bg-input)]">
                        {tool.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
