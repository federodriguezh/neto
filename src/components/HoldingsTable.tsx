import { useMemo } from 'react';
import type { Holding } from '../types';

interface HoldingsTableProps {
  holdings: Holding[];
  prices: Record<string, number>;
}

export default function HoldingsTable({ holdings, prices }: HoldingsTableProps) {
  const rows = useMemo(() => {
    return holdings.map((h) => {
      const livePrice = prices[h.symbol] ?? 0;
      const marketValue = h.quantity * livePrice;
      const unrealizedPnl = marketValue - h.quantity * h.avgCost;
      return { ...h, livePrice, marketValue, unrealizedPnl };
    });
  }, [holdings, prices]);

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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-b border-slate-700/50 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-100">{row.symbol}</td>
              <td className="px-4 py-3 text-slate-300">{row.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-300">${row.avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-slate-300">
                {row.livePrice > 0 ? `$${row.livePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
              </td>
              <td className="px-4 py-3 text-slate-300">${row.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className={`px-4 py-3 font-medium ${row.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {row.unrealizedPnl >= 0 ? '+' : ''}${row.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No holdings yet. Add a transaction to get started.</td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-800/80 font-medium">
              <td className="px-4 py-3 text-slate-200" colSpan={4}>Total</td>
              <td className="px-4 py-3 text-slate-100">${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className={`px-4 py-3 ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
