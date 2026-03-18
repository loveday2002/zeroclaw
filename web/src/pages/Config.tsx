import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { getConfig, putConfig } from '@/lib/api';

export default function Config() {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then((data) => {
        setConfig(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await putConfig(config);
      setSuccess('Configuration saved successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Auto-dismiss success after 4 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[#0080ff]" />
          <h2 className="text-sm font-semibold  uppercase tracking-wider">Configuration</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-electric flex items-center gap-2 text-sm px-4 py-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Sensitive fields note */}
      <div className="flex items-start gap-3 rounded-xl p-4 border border-status-warning/20 bg-[rgba(255,170,0,0.05)]">
        <ShieldAlert className="h-5 w-5 text-status-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-status-warning font-medium">
            Sensitive fields are masked
          </p>
          <p className="text-sm text-status-warning/50 mt-0.5">
            API keys, tokens, and passwords are hidden for security. To update a
            masked field, replace the entire masked value with your new value.
          </p>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl p-3 border border-status-success/30 animate-fade-in bg-[rgba(0,230,138,0.06)]">
          <CheckCircle className="h-4 w-4 text-[#00e68a] shrink-0" />
          <span className="text-sm text-[#00e68a]">{success}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl p-3 border border-status-error/30 animate-fade-in bg-[rgba(255,68,102,0.06)]">
          <AlertTriangle className="h-4 w-4 text-status-error shrink-0" />
          <span className="text-sm text-status-error">{error}</span>
        </div>
      )}

      {/* Config Editor */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-default bg-[rgba(0,128,255,0.03)]">
          <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
            TOML Configuration
          </span>
          <span className="text-[10px] text-text-muted">
            {config.split('\n').length} lines
          </span>
        </div>
        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          spellCheck={false}
          className="w-full min-h-125 text-text-secondary font-mono text-sm p-4 resize-y focus:outline-none focus:ring-2 focus:ring-glow-blue focus:ring-inset bg-[var(--bg-input)] tab-[4]"
        />
      </div>
    </div>
  );
}
