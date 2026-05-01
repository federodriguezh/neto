import { useCallback } from 'react';
import { Download, Upload } from 'lucide-react';
import { db } from '../db';
import type { Account } from '../types';

export default function ImportExport() {
  const handleExport = useCallback(async () => {
    const accounts = await db.accounts.toArray();
    const transactions = await db.transactions.toArray();
    const historicalPrices = await db.historicalPrices.toArray();
    const portfolioHistory = await db.portfolioHistory.toArray();
    const preferences = await db.preferences.toArray();
    const exchangeRates = await db.exchangeRates.toArray();

    const data = { accounts, transactions, historicalPrices, portfolioHistory, preferences, exchangeRates };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neto-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCsv = useCallback(async () => {
    const transactions = await db.transactions.toArray();
    if (transactions.length === 0) return;

    const headers = ['id', 'date', 'accountId', 'symbol', 'assetClass', 'type', 'quantity', 'price', 'fees', 'currency'];
    const rows = transactions.map((t) =>
      [t.id, t.date, t.accountId, t.symbol, t.assetClass, t.type, t.quantity, t.price, t.fees, t.currency].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neto-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.accounts) {
        const accounts = data.accounts.map((a: Account) => ({
          ...a,
          feeType: a.feeType ?? 'fixed',
          feeValue: a.feeValue ?? 0,
        }));
        await db.accounts.bulkPut(accounts);
      }
      if (data.transactions) await db.transactions.bulkPut(data.transactions);
      if (data.historicalPrices) await db.historicalPrices.bulkPut(data.historicalPrices);
      if (data.portfolioHistory) await db.portfolioHistory.bulkPut(data.portfolioHistory);
      if (data.preferences) await db.preferences.bulkPut(data.preferences);
      if (data.exchangeRates) await db.exchangeRates.bulkPut(data.exchangeRates);
      window.location.reload();
    } catch {
      alert('Invalid import file');
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-200">Export & Import</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <Download size={16} />
          Export JSON
        </button>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors">
          <Upload size={16} />
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </label>
      </div>
    </div>
  );
}
