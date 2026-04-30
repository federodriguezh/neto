import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useLivePrices } from '../hooks/useLivePrices';
import { usePortfolioValueHistory } from '../hooks/usePortfolioValueHistory';
import { useYesterdayCloses } from '../hooks/useYesterdayCloses';
import PortfolioChart from '../components/PortfolioChart';
import HoldingsTable from '../components/HoldingsTable';

export default function Dashboard() {
  const { holdings, loading: holdingsLoading } = usePortfolio();
  const { history, loading: historyLoading } = usePortfolioValueHistory();

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const assetClasses = useMemo(() => holdings.map((h) => h.assetClass), [holdings]);
  const { prices, loading: pricesLoading, error: pricesError } = useLivePrices(symbols, assetClasses);
  const yesterdayPrices = useYesterdayCloses(symbols);

  const totalValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const price = prices[h.symbol] ?? 0;
      return sum + h.quantity * price;
    }, 0);
  }, [holdings, prices]);

  const dailyChange = useMemo(() => {
    const yesterdayValue = history.length >= 2 ? history[history.length - 2].value : 0;
    return yesterdayValue > 0 ? totalValue - yesterdayValue : 0;
  }, [history, totalValue]);

  const dailyChangePercent = useMemo(() => {
    const yesterdayValue = history.length >= 2 ? history[history.length - 2].value : 0;
    if (yesterdayValue === 0) return 0;
    return (dailyChange / yesterdayValue) * 100;
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

      {pricesError && (
        <div className="rounded-xl bg-rose-900/30 border border-rose-800 p-4 text-sm text-rose-300">
          <strong className="text-rose-200">Price data unavailable:</strong> {pricesError}
        </div>
      )}

      <PortfolioChart history={history} />
      <HoldingsTable holdings={holdings} prices={prices} yesterdayPrices={yesterdayPrices} />
    </div>
  );
}
