import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Settings, BookOpen, Wifi, WifiOff, Cloud, DollarSign, Users, Receipt, Scale } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useHouseholds } from '../hooks/useHouseholds';
import { useState } from 'react';

interface LayoutProps {
  showOnboarding: boolean;
}

export default function Layout({ showOnboarding }: LayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline, pendingCount } = useSyncStatus();
  const { household, households, activateHousehold, activeHouseholdId } = useHouseholds();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/transactions', label: t('nav.transactions'), icon: List },
    { to: '/income', label: t('nav.income'), icon: DollarSign },
    { to: '/households', label: t('nav.households'), icon: Users },
  ];

  if (household) {
    navItems.push({ to: '/expenses', label: t('nav.expenses'), icon: Receipt });
    navItems.push({ to: '/balances', label: t('nav.balances'), icon: Scale });
  }

  navItems.push({ to: '/settings', label: t('nav.settings'), icon: Settings });

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

        {/* Household switcher */}
        {households.length > 1 && (
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowSwitcher((v) => !v)}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <Users size={16} />
              <span className="flex-1 text-left truncate">{activeHouseholdId ? (households.find((h) => h.id === activeHouseholdId)?.name || activeHouseholdId.slice(0, 8)) : 'No group'}</span>
              <span className="text-xs text-slate-500">{showSwitcher ? '▴' : '▾'}</span>
            </button>
            {showSwitcher && (
              <div className="mt-1 flex flex-col gap-1">
                {households.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { activateHousehold(h.id); setShowSwitcher(false); }}
                    className={`text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                      h.id === activeHouseholdId
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {h.name || h.id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
