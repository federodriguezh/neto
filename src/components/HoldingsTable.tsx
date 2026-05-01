import { useMemo } from 'react';
import type { Holding, DisplayCurrency } from '../types';
import { useTranslation } from '../i18n';
import { convertArsToUsd, formatCurrency } from '../utils/currency';

interface HoldingsTableProps {
  holdings: Holding[];
  prices: Record<string, number>;
  pctChanges: Record<string, number>;
  displayCurrency: DisplayCurrency;
  liveRate: number | null;
}

export default function HoldingsTable({ holdings, prices, pctChanges, displayCurrency, liveRate }: HoldingsTableProps) {
  const { t } = useTranslation();
  const isUsd = displayCurrency !== 'ARS';
  const rate = isUsd && liveRate ? liveRate : 1;

  const rows = useMemo(() => {
    return holdings.map((h) => {
      const livePriceArs = prices[h.symbol] ?? 0;
      const marketValueArs = h.quantity * livePriceArs;
      const unrealizedPnlArs = marketValueArs - h.quantity * h.avgCost;
      const dailyChgPct = pctChanges[h.symbol] ?? null;
      return {
        ...h,
        livePrice: convertArsToUsd(livePriceArs, rate),
        marketValue: convertArsToUsd(marketValueArs, rate),
        unrealizedPnl: convertArsToUsd(unrealizedPnlArs, rate),
        dailyChgPct,
      };
    });
  }, [holdings, prices, pctChanges, rate]);

  const totalMarketValue = useMemo(() => rows.reduce((sum, r) => sum + r.marketValue, 0), [rows]);
  const totalUnrealizedPnl = useMemo(() => rows.reduce((sum, r) => sum + r.unrealizedPnl, 0), [rows]);

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-800">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="px-4 py-3 font-medium">{t('holdings.symbol')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.qty')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.avgCost')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.livePrice')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.marketValue')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.unrealizedPnl')}</th>
            <th className="px-4 py-3 font-medium">{t('holdings.dailyChg')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-slate-700/50 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-100">{row.symbol}</td>
              <td className="px-4 py-3 text-slate-300">{row.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-300">{formatCurrency(row.avgCost / rate, displayCurrency)}</td>
              <td className="px-4 py-3 text-slate-300">
                {row.livePrice > 0 ? formatCurrency(row.livePrice, displayCurrency) : t('dashboard.loading')}
              </td>
              <td className="px-4 py-3 text-slate-300">{formatCurrency(row.marketValue, displayCurrency)}</td>
              <td className={`px-4 py-3 font-medium ${row.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {row.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(row.unrealizedPnl, displayCurrency)}
              </td>
              <td className={`px-4 py-3 font-medium ${
                row.dailyChgPct === null ? 'text-slate-500' : row.dailyChgPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {row.dailyChgPct === null ? t('dashboard.loading') : `${row.dailyChgPct >= 0 ? '+' : ''}${row.dailyChgPct.toFixed(2)}%`}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-500">{t('holdings.none')}</td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-800/80 font-medium">
              <td className="px-4 py-3 text-slate-200" colSpan={4}>{t('holdings.total')}</td>
              <td className="px-4 py-3 text-slate-100">{formatCurrency(totalMarketValue, displayCurrency)}</td>
              <td className={`px-4 py-3 ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl, displayCurrency)}
              </td>
              <td className="px-4 py-3 text-slate-500">{t('dashboard.loading')}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
