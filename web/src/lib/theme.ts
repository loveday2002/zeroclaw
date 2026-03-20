/**
 * Theme-aware style utilities for light/dark mode
 * Returns inline styles using CSS variables
 */

export function themeStyles() {
  return {
    // Background colors
    bgPrimary: { backgroundColor: 'var(--bg-primary)' },
    bgSecondary: { backgroundColor: 'var(--bg-secondary)' },
    bgCard: { backgroundColor: 'var(--bg-card)' },
    bgCardHover: { backgroundColor: 'var(--bg-card-hover)' },
    bgInput: { backgroundColor: 'var(--bg-input)' },

    // Text colors
    textPrimary: { color: 'var(--text-primary)' },
    textSecondary: { color: 'var(--text-secondary)' },
    textMuted: { color: 'var(--text-muted)' },

    // Border colors
    borderDefault: { borderColor: 'var(--border-default)' },
    borderSubtle: { borderColor: 'var(--border-subtle)' },

    // Accent colors
    accentBlue: { color: 'var(--accent-blue)' },
    accentBlueHover: { color: 'var(--accent-blue-hover)' },
  };
}

// Pre-defined style objects for common patterns
export const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '1rem',
    transition: 'all 0.3s ease',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: '0.75rem',
    color: 'var(--text-primary)',
    transition: 'all 0.3s ease',
  },
  header: {
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-default)',
  },
  errorBox: {
    background: 'rgba(255, 68, 102, 0.1)',
    border: '1px solid rgba(255, 68, 102, 0.3)',
    color: 'var(--status-error)',
    borderRadius: '0.75rem',
  },
  successBox: {
    background: 'rgba(0, 230, 138, 0.1)',
    border: '1px solid rgba(0, 230, 138, 0.3)',
    color: 'var(--status-success)',
    borderRadius: '0.75rem',
  },
};
