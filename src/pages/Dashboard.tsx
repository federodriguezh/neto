import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useLivePrices } from '../hooks/useLivePrices';
import { usePortfolioValueHistory } from '../hooks/usePortfolioValueHistory';
import PortfolioChart from '../components/PortfolioChart';
import HoldingsTable from '../components/HoldingsTable';

export default function Dashboard() {
  const { holdings, loading: holdingsLoading } = usePortfolio();
  const { history, loading: historyLoading } = usePortfolioValueHistory();

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const assetClasses = useMemo(() => holdings.map((h) => h.assetClass), [holdings]);
  const { prices, loading: pricesLoading } = useLivePrices(symbols, assetClasses);

  const totalValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const price = prices[h.symbol] ?? 0;
      return sum + h.quantity * price;
    }, 0);
  }, [holdings, prices]);

  const dailyChange = useMemo(() => {
    if (history.length < 2) return 0;
    const today = history[history.length - 1]?.value ?? 0;
    const yesterday = history[history.length - 2]?.value ?? 0;
    return today - yesterday;
  }, [history]);

  const dailyChangePercent = useMemo(() => {
    if (history.length < 2) return 0;
    const yesterday = history[history.length - 2]?.value ?? 0;
    if (yesterday === 0) return 0;
    return (dailyChange / yesterday) * 100;
  }, [history, dailyChange]);

  const isLoading = holdingsLoading || historyLoading || pricesLoading;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Wallet size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {isLoading ? '—' : `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            {dailyChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-xs font-medium uppercase tracking-wider">Daily Change</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading ? '—' : `${dailyChange >= 0 ? '+' : ''}$${dailyChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Daily Change %</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading ? '—' : `${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%`}
          </div>
        </div>
      </div>

      <PortfolioChart history={history} />
      <HoldingsTable holdings={holdings} prices={prices} />
    </div>
  );
}
