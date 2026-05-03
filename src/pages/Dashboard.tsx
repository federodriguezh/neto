import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useLivePrices } from '../hooks/useLivePrices';
import { usePortfolioValueHistory } from '../hooks/usePortfolioValueHistory';
import { useYesterdayCloses } from '../hooks/useYesterdayCloses';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { useLiveExchangeRate } from '../hooks/useLiveExchangeRate';
import { useConvertedHistory } from '../hooks/useConvertedHistory';
import { useSpyComparison } from '../hooks/useSpyComparison';
import { useRealizedPnlConverted } from '../hooks/useRealizedPnlConverted';
import { useTranslation } from '../i18n';
import { convertArsToUsd, formatCurrency } from '../utils/currency';
import PortfolioChart from '../components/PortfolioChart';
import ComparisonChart from '../components/ComparisonChart';
import HoldingsTable from '../components/HoldingsTable';
import LiveMepRateCard from '../components/LiveMepRateCard';
import RangeSelector from '../components/RangeSelector';
import type { Range } from '../components/RangeSelector';

export default function Dashboard() {
  const { t } = useTranslation();
  const { holdings, transactions, loading: holdingsLoading, shortPositions } = usePortfolio();
  const { history } = usePortfolioValueHistory();
  const { displayCurrency } = useDisplayCurrency();
  const { convertedPnl: totalRealizedPnl, loading: pnlLoading } = useRealizedPnlConverted(transactions, displayCurrency);

  const [range, setRange] = useState<Range>('30');
  const [comparisonMode, setComparisonMode] = useState(false);

  const exchangeRateType = displayCurrency === 'MEP' || displayCurrency === 'CCL'
    ? (displayCurrency === 'MEP' ? 'mep' : 'ccl')
    : null;
  const { rate: liveRate, error: rateError } = useLiveExchangeRate(exchangeRateType);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const assetClasses = useMemo(() => holdings.map((h) => h.assetClass), [holdings]);
  const { prices, pctChanges, loading: pricesLoading, error: pricesError } = useLivePrices(symbols, assetClasses);
  const { yesterdayPrices, loading: yesterdayPricesLoading } = useYesterdayCloses(symbols);
  const { convertedHistory } = useConvertedHistory(history, displayCurrency);

  // Filter history by selected range
  const filteredHistory = useMemo(() => {
    if (range === 'max') return convertedHistory;
    const days = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return convertedHistory.filter((h) => h.date >= cutoffStr);
  }, [convertedHistory, range]);

  // SPY comparison (only in USD modes)
  const { data: comparisonData } = useSpyComparison(
    filteredHistory,
    transactions,
    comparisonMode && displayCurrency !== 'ARS'
  );

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

  const isLoading = holdingsLoading || pricesLoading || yesterdayPricesLoading || pnlLoading;

  const totalValue = exchangeRateType && liveRate
    ? convertArsToUsd(totalValueArs, liveRate)
    : totalValueArs;

  const dailyChange = exchangeRateType && liveRate
    ? convertArsToUsd(dailyChangeArs, liveRate)
    : dailyChangeArs;

  const realizedPnlDisplay = totalRealizedPnl;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Wallet size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">{t('dashboard.totalValue')}</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {isLoading ? t('dashboard.loading') : formatCurrency(totalValue, displayCurrency)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            {dailyChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-xs font-medium uppercase tracking-wider">{t('dashboard.dailyChange')}</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading || !hasValidBase ? t('dashboard.loading') : `${dailyChange >= 0 ? '+' : ''}${formatCurrency(dailyChange, displayCurrency)}`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">{t('dashboard.dailyChangePercent')}</span>
          </div>
          <div className={`text-2xl font-bold ${dailyChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isLoading || !hasValidBase ? t('dashboard.loading') : `${dailyChangePercent >= 0 ? '+' : ''}${dailyChangePercent.toFixed(2)}%`}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Receipt size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">{t('dashboard.realizedPnl')}</span>
          </div>
          <div className={`text-2xl font-bold ${realizedPnlDisplay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {holdingsLoading ? t('dashboard.loading') : `${realizedPnlDisplay >= 0 ? '+' : ''}${formatCurrency(realizedPnlDisplay, displayCurrency)}`}
          </div>
        </div>
      </div>

      {(pricesError || rateError) && (
        <div className="rounded-xl bg-rose-900/30 border border-rose-800 p-4 text-sm text-rose-300">
          <strong className="text-rose-200">{t('dashboard.dataUnavailable')}</strong> {pricesError ?? rateError}
        </div>
      )}

      {shortPositions.length > 0 && (
        <div className="rounded-xl bg-amber-900/30 border border-amber-800 p-4 text-sm text-amber-300">
          <strong className="text-amber-200">{t('dashboard.shortPositions')}</strong>
          <p className="mt-1 text-amber-300/80">{t('dashboard.shortPositionsDescription')}</p>
          <ul className="mt-2 list-disc list-inside">
            {shortPositions.map((s) => (
              <li key={s.symbol}>
                {s.symbol} ({s.assetClass}): {s.quantity.toLocaleString()} shares
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-slate-800 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            {displayCurrency === 'ARS' ? (
              <LiveMepRateCard />
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => setComparisonMode(false)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    !comparisonMode
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {t('dashboard.value')}
                </button>
                <button
                  onClick={() => setComparisonMode(true)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    comparisonMode
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {t('dashboard.compareSpy')}
                </button>
              </div>
            )}
          </div>
          <RangeSelector range={range} onChange={setRange} />
        </div>

        {comparisonMode && displayCurrency !== 'ARS' ? (
          <ComparisonChart data={comparisonData} />
        ) : (
          <PortfolioChart history={filteredHistory} displayCurrency={displayCurrency} />
        )}
      </div>

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
