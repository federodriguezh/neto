import { useMemo } from 'react';
import type { Holding, DisplayCurrency } from '../types';
import { convertArsToUsd, formatCurrency } from '../utils/currency';

interface HoldingsTableProps {
  holdings: Holding[];
  prices: Record<string, number>;
  pctChanges: Record<string, number>;
  displayCurrency: DisplayCurrency;
  liveRate: number | null;
}

export default function HoldingsTable({ holdings, prices, pctChanges, displayCurrency, liveRate }: HoldingsTableProps) {
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
            <th className="px-4 py-3 font-medium">Symbol</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Avg Cost</th>
            <th className="px-4 py-3 font-medium">Live Price</th>
            <th className="px-4 py-3 font-medium">Market Value</th>
            <th className="px-4 py-3 font-medium">Unrealized P&L</th>
            <th className="px-4 py-3 font-medium">Daily Chg %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-slate-700/50 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-100">{row.symbol}</td>
              <td className="px-4 py-3 text-slate-300">{row.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-300">{formatCurrency(row.avgCost / rate, displayCurrency)}</td>
              <td className="px-4 py-3 text-slate-300">
                {row.livePrice > 0 ? formatCurrency(row.livePrice, displayCurrency) : '—'}
              </td>
              <td className="px-4 py-3 text-slate-300">{formatCurrency(row.marketValue, displayCurrency)}</td>
              <td className={`px-4 py-3 font-medium ${row.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {row.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(row.unrealizedPnl, displayCurrency)}
              </td>
              <td className={`px-4 py-3 font-medium ${
                row.dailyChgPct === null ? 'text-slate-500' : row.dailyChgPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {row.dailyChgPct === null ? '—' : `${row.dailyChgPct >= 0 ? '+' : ''}${row.dailyChgPct.toFixed(2)}%`}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No holdings yet. Add a transaction to get started.</td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-800/80 font-medium">
              <td className="px-4 py-3 text-slate-200" colSpan={4}>Total</td>
              <td className="px-4 py-3 text-slate-100">{formatCurrency(totalMarketValue, displayCurrency)}</td>
              <td className={`px-4 py-3 ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl, displayCurrency)}
              </td>
              <td className="px-4 py-3 text-slate-500">—</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
