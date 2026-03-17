import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { ThemeProvider } from '@/hooks/useTheme';

export default function Layout() {
  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {/* Fixed sidebar */}
        <Sidebar />

        {/* Main area offset by sidebar width (240px / w-60) */}
        <div className="ml-60 flex flex-col min-h-screen">
          <Header />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
