import { useLocation } from 'react-router-dom';
import { LogOut, Sun, Moon } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useLocaleContext } from '@/App';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const routeTitles: Record<string, string> = {
  '/': 'nav.dashboard',
  '/agent': 'nav.agent',
  '/tools': 'nav.tools',
  '/cron': 'nav.cron',
  '/integrations': 'nav.integrations',
  '/memory': 'nav.memory',
  '/config': 'nav.config',
  '/cost': 'nav.cost',
  '/logs': 'nav.logs',
  '/doctor': 'nav.doctor',
};

export default function Header() {
  const location = useLocation();
  const { logout } = useAuth();
  const { locale, setAppLocale } = useLocaleContext();
  const { theme, toggleTheme } = useTheme();

  const titleKey = routeTitles[location.pathname] ?? 'nav.dashboard';
  const pageTitle = t(titleKey);

  const toggleLanguage = () => {
    // Cycle through: en -> zh -> tr -> en
    const nextLocale = locale === 'en' ? 'zh' : locale === 'zh' ? 'tr' : 'en';
    setAppLocale(nextLocale);
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b animate-fade-in" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', backdropFilter: 'blur(12px)' }}>
      {/* Page title */}
      <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{pageTitle}</h1>

      {/* Right-side controls */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border transition-all duration-300 hover:scale-105"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)' }}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* Language switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-300"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {locale === 'en' ? 'EN' : 'TR'}
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-300"
          style={{ color: 'var(--text-secondary)' }}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{t('auth.logout')}</span>
        </button>
      </div>
    </header>
  );
}
