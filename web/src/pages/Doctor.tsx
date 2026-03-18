import { useState } from 'react';
import {
  Stethoscope,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { DiagResult } from '@/types/api';
import { runDoctor } from '@/lib/api';

function severityIcon(severity: DiagResult['severity']) {
  switch (severity) {
    case 'ok':
      return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  }
}

function severityBorder(severity: DiagResult['severity']): string {
  switch (severity) {
    case 'ok':
      return 'border-emerald-500/12';
    case 'warn':
      return 'border-amber-500/12';
    case 'error':
      return 'border-red-500/12';
  }
}

function severityBg(severity: DiagResult['severity']): string {
  switch (severity) {
    case 'ok':
      return 'rgba(0,230,138,0.04)';
    case 'warn':
      return 'rgba(255,170,0,0.04)';
    case 'error':
      return 'rgba(255,68,102,0.04)';
  }
}

export default function Doctor() {
  const [results, setResults] = useState<DiagResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await runDoctor();
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const okCount = results?.filter((r) => r.severity === 'ok').length ?? 0;
  const warnCount = results?.filter((r) => r.severity === 'warn').length ?? 0;
  const errorCount = results?.filter((r) => r.severity === 'error').length ?? 0;

  const grouped =
    results?.reduce<Record<string, DiagResult[]>>((acc, item) => {
      const key = item.category;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {}) ?? {};

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold  uppercase tracking-wider">Diagnostics</h2>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="btn-electric flex items-center gap-2 text-sm px-4 py-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Diagnostics
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/8 border-red-500/20 p-4 text-red-400 animate-fade-in">
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="h-12 w-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-slate-400">Running diagnostics...</p>
          <p className="text-sm text-slate-500 mt-1">
            This may take a few seconds.
          </p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          {/* Summary Bar */}
          <div className="glass-card flex items-center gap-4 p-4 animate-slide-in-up">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium">
                {okCount} <span className="text-slate-500 font-normal">ok</span>
              </span>
            </div>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium">
                {warnCount}{' '}
                <span className="text-slate-500 font-normal">
                  warning{warnCount !== 1 ? 's' : ''}
                </span>
              </span>
            </div>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium">
                {errorCount}{' '}
                <span className="text-slate-500 font-normal">
                  error{errorCount !== 1 ? 's' : ''}
                </span>
              </span>
            </div>

            {/* Overall indicator */}
            <div className="ml-auto">
              {errorCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border text-red-400 border-red-500/20 bg-red-500/6">
                  Issues Found
                </span>
              ) : warnCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border text-amber-400 border-amber-500/20 bg-amber-500/6">
                  Warnings
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border text-emerald-400 border-emerald-500/20 bg-emerald-500/6">
                  All Clear
                </span>
              )}
            </div>
          </div>

          {/* Grouped Results */}
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items], catIdx) => (
              <div key={category} className="animate-slide-in-up" style={{ animationDelay: `${(catIdx + 1) * 100}ms` }}>
                <h3 className="text-[10px] font-semibold text-[#334060] uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2 stagger-children">
                  {items.map((result, idx) => (
                    <div
                      key={`${category}-${idx}`}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition-all duration-300 hover:translate-x-1 ${severityBorder(result.severity)} animate-slide-in-left`}
                      style={{ background: severityBg(result.severity) }}
                    >
                      {severityIcon(result.severity)}
                      <div className="min-w-0">
                        <p className="text-sm">{result.message}</p>
                        <p className="text-[10px] text-[#334060] mt-0.5 uppercase tracking-wider">
                          {result.severity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </>
      )}

      {/* Empty state */}
      {!results && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600 animate-fade-in">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 animate-float" style={{ background: 'linear-gradient(135deg, rgba(0,128,255,0.08), rgba(0,128,255,0.03))' }}>
            <Stethoscope className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-lg font-semibold mb-1">System Diagnostics</p>
          <p className="text-sm text-slate-500">
            Click "Run Diagnostics" to check your ZeroClaw installation.
          </p>
        </div>
      )}
    </div>
  );
}
