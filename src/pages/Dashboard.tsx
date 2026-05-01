import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useLivePrices } from '../hooks/useLivePrices';
import { usePortfolioValueHistory } from '../hooks/usePortfolioValueHistory';
import { useYesterdayCloses } from '../hooks/useYesterdayCloses';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { useLiveExchangeRate } from '../hooks/useLiveExchangeRate';
import { useConvertedHistory } from '../hooks/useConvertedHistory';
import { convertArsToUsd, formatCurrency } from '../utils/currency';
import PortfolioChart from '../components/PortfolioChart';
import HoldingsTable from '../components/HoldingsTable';

export default function Dashboard() {
  const { holdings, totalRealizedPnl, loading: holdingsLoading } = usePortfolio();
  const { history } = usePortfolioValueHistory();
  const { displayCurrency } = useDisplayCurrency();
  const exchangeRateType = displayCurrency === 'MEP' || displayCurrency === 'CCL'
    ? (displayCurrency === 'MEP' ? 'mep' : 'ccl')
    : null;
  const { rate: liveRate, error: rateError } = useLiveExchangeRate(exchangeRateType);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const assetClasses = useMemo(() => holdings.map((h) => h.assetClass), [holdings]);
  const { prices, pctChanges, loading: pricesLoading, error: pricesError } = useLivePrices(symbols, assetClasses);
  const { yesterdayPrices, loading: yesterdayPricesLoading } = useYesterdayCloses(symbols);
  const { convertedHistory } = useConvertedHistory(history, displayCurrency);

  const totalValueArs = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const price = prices[h.symbol] ?? 0;
      return sum + h.quantity * price;
    }, 0);
  }, [holdings, prices]);

  const { dailyChangeArs, dailyChangePercent } = useMemo(() => {
    let change = 0;
    let baseValue = 0;
    for (const h of holdings) {
      const live = prices[h.symbol] ?? 0;
      const base = yesterdayPrices[h.symbol];
      if (base === undefined) continue;
      change += h.quantity * (live - base);
      baseValue += h.quantity * base;
    }
    const percent = baseValue > 0 ? (change / baseValue) * 100 : 0;
    return { dailyChangeArs: change, dailyChangePercent: percent };
  }, [holdings, prices, yesterdayPrices]);

  const hasValidBase = useMemo(() => {
    return holdings.some((h) => yesterdayPrices[h.symbol] !== undefined);
  }, [holdings, yesterdayPrices]);

  const isLoading = holdingsLoading || pricesLoading || yesterdayPricesLoading;

  const totalValue = exchangeRateType && liveRate
    ? convertArsToUsd(totalValueArs, liveRate)
    : totalValueArs;

  const dailyChange = exchangeRateType && liveRate
    ? convertArsToUsd(dailyChangeArs, liveRate)
    : dailyChangeArs;

  const realizedPnlDisplay = exchangeRateType && liveRate
    ? convertArsToUsd(totalRealizedPnl, liveRate)
    : totalRealizedPnl;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Wallet size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {isLoading ? '—' : formatCurrency(totalValue, displayCurrency)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            {dailyChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-xs font-medium uppercase tracking-wider">Daily Change</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading || !hasValidBase ? '—' : `${dailyChange >= 0 ? '+' : ''}${formatCurrency(dailyChange, displayCurrency)}`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Daily Change %</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading || !hasValidBase ? '—' : `${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Receipt size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Total Realized P&L</span>
          </div>
          <div className={`text-2xl font-bold ${realizedPnlDisplay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {holdingsLoading ? '—' : `${realizedPnlDisplay >= 0 ? '+' : ''}${formatCurrency(realizedPnlDisplay, displayCurrency)}`}
          </div>
        </div>
      </div>

      {(pricesError || rateError) && (
        <div className="rounded-xl bg-rose-900/30 border border-rose-800 p-4 text-sm text-rose-300">
          <strong className="text-rose-200">Data unavailable:</strong> {pricesError ?? rateError}
        </div>
      )}

      <PortfolioChart history={convertedHistory} displayCurrency={displayCurrency} />
      <HoldingsTable
        holdings={holdings}
        prices={prices}
        pctChanges={pctChanges}
        displayCurrency={displayCurrency}
        liveRate={liveRate}
      />
    </div>
  );
}
