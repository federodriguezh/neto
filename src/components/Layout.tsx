import type { ReactNode } from 'react';
import { LayoutDashboard, List, Settings } from 'lucide-react';

type Route = 'dashboard' | 'transactions' | 'settings';

interface LayoutProps {
  children: ReactNode;
  current: Route;
  onNavigate: (route: Route) => void;
}

const NAV_ITEMS: { route: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'transactions', label: 'Transactions', icon: List },
  { route: 'settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children, current, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-64 flex-col gap-1 bg-slate-900 p-4 border-r border-slate-800">
        <div className="mb-6 text-xl font-bold text-slate-100">neto</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.route;
          return (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                active
                  ? 'bg-slate-800 text-slate-50'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.route;
          return (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
                active
                  ? 'text-slate-50'
                  : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        {children}
      </main>
    </div>
  );
}
