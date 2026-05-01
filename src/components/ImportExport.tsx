import { useCallback } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { db, addTransaction } from '../db';
import type { Account, AssetClass, TransactionType } from '../types';
import { useTranslation } from '../i18n';
import { importCsv } from '../utils/csvImport';
import { normalizeDate } from '../utils/date';
import { calculateRealizedPnl } from '../utils/realizedPnl';

const CSV_TEMPLATE = `date,account,symbol,assetClass,type,quantity,price,fees,currency
2024-01-15,MyBroker,GGAL,arg_stocks,buy,100,2500.50,12.63,ARS
2024-02-20,MyBroker,GGAL,arg_stocks,sell,50,2800.00,7.42,ARS
2024-03-10,MyBroker,AAPL,arg_cedears,buy,10,185.50,5.00,ARS
2024-04-05,MyBroker,AL30,arg_bonds,buy,500,28.50,2.50,ARS
2024-05-12,MyBroker,AAPL,arg_cedears,sell,5,190.00,3.00,ARS`;

export default function ImportExport() {
  const { t } = useTranslation();

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

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neto-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);

      const isOldFormat = data.accounts?.length > 0 && typeof data.accounts[0].id === 'number';

      let accounts = data.accounts ?? [];
      let transactions = data.transactions ?? [];

      if (isOldFormat) {
        const idMap = new Map<unknown, string>();
        accounts = accounts.map((a: Record<string, unknown>) => {
          const newId = crypto.randomUUID();
          idMap.set(a.id, newId);
          return {
            ...a,
            id: newId,
            updatedAt: (a.createdAt as string) ?? new Date().toISOString().split('T')[0],
          };
        });
        transactions = transactions.map((t: Record<string, unknown>) => {
          const newId = crypto.randomUUID();
          const newAccountId = idMap.get(t.accountId);
          if (!newAccountId) throw new Error(`Missing account mapping for transaction ${String(t.id)}`);
          return {
            ...t,
            id: newId,
            accountId: newAccountId,
            updatedAt: (t.date as string) ?? new Date().toISOString().split('T')[0],
            createdAt: (t.date as string) ?? new Date().toISOString().split('T')[0],
          };
        });
      }

      // Validate transactions before import
      const VALID_ASSET_CLASSES: AssetClass[] = ['arg_stocks', 'arg_cedears', 'arg_bonds'];
      const VALID_TYPES: TransactionType[] = ['buy', 'sell'];
      const importErrors: string[] = [];

      transactions = transactions.map((t: Record<string, unknown>) => {
        const tx = { ...t };
        // Normalize type
        if (typeof tx.type === 'string') {
          tx.type = tx.type.toLowerCase().trim() as TransactionType;
        }
        // Normalize assetClass
        if (typeof tx.assetClass === 'string') {
          tx.assetClass = tx.assetClass.trim() as AssetClass;
        }
        // Normalize date
        tx.date = normalizeDate(tx.date as string) || tx.date;
        return tx;
      });

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i] as Record<string, unknown>;
        const rowNum = i + 1;
        const rowErrors: string[] = [];
        if (!VALID_TYPES.includes(tx.type as TransactionType)) rowErrors.push(`invalid type: ${tx.type}`);
        if (!VALID_ASSET_CLASSES.includes(tx.assetClass as AssetClass)) rowErrors.push(`invalid assetClass: ${tx.assetClass}`);
        const qty = Number(tx.quantity);
        if (!Number.isFinite(qty) || qty <= 0) rowErrors.push(`invalid quantity: ${tx.quantity}`);
        const price = Number(tx.price);
        if (!Number.isFinite(price) || price <= 0) rowErrors.push(`invalid price: ${tx.price}`);
        const fees = Number(tx.fees ?? 0);
        if (!Number.isFinite(fees) || fees < 0) rowErrors.push(`invalid fees: ${tx.fees}`);
        if (!tx.date || typeof tx.date !== 'string') rowErrors.push(`invalid date: ${tx.date}`);
        if (rowErrors.length > 0) {
          importErrors.push(`Tx ${rowNum}: ${rowErrors.join(', ')}`);
        }
      }

      if (importErrors.length > 0) {
        alert(`${t('import.validationErrors')}\n${importErrors.join('\n')}`);
        return;
      }

      // Clear existing data before import to avoid stale records
      await db.transactions.clear();
      await db.accounts.clear();
      await db.portfolioHistory.clear();

      if (accounts.length > 0) {
        accounts = accounts.map((a: Account) => ({
          ...a,
          createdAt: normalizeDate(a.createdAt) || a.createdAt,
          feeType: a.feeType ?? 'fixed',
          feeValue: a.feeValue ?? 0,
        }));
        await db.accounts.bulkPut(accounts);
      }
      if (transactions.length > 0) {
        await db.transactions.bulkPut(transactions);
      }
      if (data.historicalPrices) await db.historicalPrices.bulkPut(data.historicalPrices);
      if (data.preferences) await db.preferences.bulkPut(data.preferences);
      if (data.exchangeRates) await db.exchangeRates.bulkPut(data.exchangeRates);

      // Compute realized P&L for all imported sells
      const allTxs = await db.transactions.toArray();
      for (const tx of allTxs) {
        if (tx.type === 'sell') {
          const pnl = calculateRealizedPnl(tx, allTxs);
          await db.transactions.update(tx.id, { realizedPnl: pnl });
        }
      }

      window.location.reload();
    } catch {
      alert(t('import.invalidFile'));
    }
  }, [t]);

  const handleImportCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const result = await importCsv(text);
      if (result.transactions.length > 0) {
        for (const tx of result.transactions) {
          await addTransaction(tx);
        }
      }
      const msg = t('import.csv.success', { count: String(result.count), errors: String(result.errors.length) });
      if (result.errors.length > 0) {
        alert(`${msg}\n\n${t('import.csv.errors')}\n${result.errors.join('\n')}`);
      } else {
        alert(msg);
      }
      if (result.count > 0) {
        window.location.reload();
      }
    } catch {
      alert(t('import.invalidFile'));
    }
  }, [t]);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-800 p-4">
      <h3 className="text-sm font-medium text-slate-200">{t('settings.exportImport')}</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <Download size={16} />
          {t('settings.exportJson')}
        </button>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <Download size={16} />
          {t('settings.exportCsv')}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors">
          <Upload size={16} />
          {t('settings.importJson')}
          <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors">
          <Upload size={16} />
          {t('settings.importCsv')}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
        </label>
        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          <FileSpreadsheet size={16} />
          {t('settings.csvTemplate')}
        </button>
      </div>
    </div>
  );
}
