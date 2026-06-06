import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Settings, BookOpen, Wifi, WifiOff, Cloud } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';

interface LayoutProps {
  showOnboarding: boolean;
}

export default function Layout({ showOnboarding }: LayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline, pendingCount } = useSyncStatus();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/transactions', label: t('nav.transactions'), icon: List },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  if (showOnboarding && location.pathname !== '/onboarding') {
    navigate('/onboarding', { replace: true });
  }

  if (showOnboarding) {
    navItems.push({ to: '/onboarding', label: t('nav.onboarding'), icon: BookOpen });
  }

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
      isActive
        ? 'bg-slate-800 text-slate-50'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;

  const mobileLinkClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
      isActive ? 'text-slate-50' : 'text-slate-400'
    }`;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav className="hidden md:flex w-64 flex-col gap-1 bg-slate-900 p-4 border-r border-slate-800">
        <div className="mb-6 text-xl font-bold text-slate-100">neto</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          );
        })}
        <div className="mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            {isOnline ? (
              <>
                <Wifi size={14} className="text-emerald-400" />
                <span className="text-slate-400">Online</span>
                {pendingCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-amber-400">
                    <Cloud size={12} />
                    {pendingCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-rose-400" />
                <span className="text-slate-400">Offline</span>
              </>
            )}
          </div>
        </div>
      </nav>

      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => mobileLinkClass(isActive)}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        <Outlet />
      </main>
    </div>
  );
}
