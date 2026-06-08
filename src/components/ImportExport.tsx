import { useCallback } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { db, addTransaction, updateAllRealizedPnl } from '../db';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Account, AssetClass, ExchangeRate, HistoricalPrice, Preference, Transaction, TransactionType, IncomeEntry, Expense } from '../types';
import { useTranslation } from '../i18n';
import { importCsv } from '../utils/csvImport';
import { normalizeDate } from '../utils/date';
import { convertTransactionToArs } from '../utils/convertToArs';
import { ensureHistoricalExchangeRates } from '../api/exchangeRates';

const CSV_TEMPLATE = `date,account,symbol,assetClass,type,quantity,price,fees,currency
2024-01-15,MyBroker,GGAL,arg_stocks,buy,100,2500.50,12.63,ARS
2024-02-20,MyBroker,GGAL,arg_stocks,sell,50,2800.00,7.42,ARS
2024-03-10,MyBroker,AAPL,arg_cedears,buy,10,185.50,5.00,ARS
2024-04-05,MyBroker,AL30,arg_bonds,buy,500,28.50,2.50,ARS
2024-05-12,MyBroker,AAPL,arg_cedears,sell,5,190.00,3.00,ARS`;

const SENSITIVE_PREF_KEYS = new Set(['syncPat', 'syncGistId', 'syncEnabled', 'syncLastAt']);

function filterSafePreferences(preferences: Preference[]): Preference[] {
  return preferences.filter((p) => !SENSITIVE_PREF_KEYS.has(p.key));
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function ImportExport() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const handleExport = useCallback(async () => {
    const accounts = await db.accounts.toArray();
    const transactions = await db.transactions.toArray();
    const historicalPrices = await db.historicalPrices.toArray();
    const portfolioHistory = await db.portfolioHistory.toArray();
    const preferences = filterSafePreferences(await db.preferences.toArray());
    const exchangeRates = await db.exchangeRates.toArray();

    let incomeEntries: IncomeEntry[] = [];
    let expenses: Expense[] = [];

    if (user) {
      const { data: incomeData } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);
      incomeEntries = incomeData || [];

      const { data: expenseData } = await supabase
        .from('expenses')
        .select('*')
        .eq('created_by', user.id)
        .is('deleted_at', null);
      expenses = expenseData || [];
    }

    const data = { accounts, transactions, historicalPrices, portfolioHistory, preferences, exchangeRates, incomeEntries, expenses };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neto-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [user]);

  const handleExportCsv = useCallback(async () => {
    const transactions = await db.transactions.toArray();
    if (transactions.length === 0) return;

    const headers = ['id', 'date', 'accountId', 'symbol', 'assetClass', 'type', 'quantity', 'price', 'fees', 'currency'];
    const rows = transactions.map((t) =>
      [t.id, t.date, t.accountId, t.symbol, t.assetClass, t.type, t.quantity, t.price, t.fees, t.currency]
        .map(escapeCsvCell)
        .join(',')
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

      let accounts = (Array.isArray(data.accounts) ? data.accounts : []) as Record<string, unknown>[];
      let transactions = (Array.isArray(data.transactions) ? data.transactions : []) as Record<string, unknown>[];

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
        if (typeof tx.type === 'string') {
          tx.type = tx.type.toLowerCase().trim() as TransactionType;
        }
        if (typeof tx.assetClass === 'string') {
          tx.assetClass = tx.assetClass.trim() as AssetClass;
        }
        if (typeof tx.symbol === 'string') {
          tx.symbol = tx.symbol.trim().toUpperCase();
        }
        tx.date = normalizeDate(tx.date as string) || tx.date;
        tx.quantity = Number(tx.quantity);
        tx.price = Number(tx.price);
        tx.fees = Number(tx.fees ?? 0);
        return tx;
      });

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i] as Record<string, unknown>;
        const rowNum = i + 1;
        const rowErrors: string[] = [];
        if (!VALID_TYPES.includes(tx.type as TransactionType)) rowErrors.push(`invalid type: ${tx.type}`);
        if (!VALID_ASSET_CLASSES.includes(tx.assetClass as AssetClass)) rowErrors.push(`invalid assetClass: ${tx.assetClass}`);
        if (typeof tx.symbol !== 'string' || tx.symbol.length === 0) rowErrors.push(`invalid symbol: ${tx.symbol}`);
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

      const normalizedAccounts: Account[] = [];
      if (accounts.length > 0) {
        for (const a of accounts as Record<string, unknown>[]) {
          const id = String(a.id ?? '');
          const name = String(a.name ?? '');
          const createdAt = String(a.createdAt ?? new Date().toISOString().split('T')[0]);
          if (!id || !name) {
            alert(`${t('import.validationErrors')}\nInvalid account: ${name || id || 'missing id/name'}`);
            return;
          }
          normalizedAccounts.push({
            id,
            name,
            createdAt: normalizeDate(createdAt) || createdAt,
            updatedAt: String(a.updatedAt ?? new Date().toISOString()),
            feeType: a.feeType === 'percentage' ? 'percentage' : 'fixed',
            feeValue: Number(a.feeValue ?? 0),
          });
        }
      }

      const accountIds = new Set(normalizedAccounts.map((a) => a.id));
      for (let i = 0; i < transactions.length; i++) {
        if (!accountIds.has(String(transactions[i].accountId))) {
          alert(`${t('import.validationErrors')}\nTx ${i + 1}: missing account ${String(transactions[i].accountId)}`);
          return;
        }
      }

      const importedExchangeRates = Array.isArray(data.exchangeRates) ? data.exchangeRates as ExchangeRate[] : [];
      const importedHistoricalPrices = Array.isArray(data.historicalPrices) ? data.historicalPrices as HistoricalPrice[] : [];
      const importedPreferences = Array.isArray(data.preferences) ? filterSafePreferences(data.preferences as Preference[]) : [];

      // Import exchange rates before conversion, but do not clear user data until everything is ready.
      if (importedExchangeRates.length > 0) await db.exchangeRates.bulkPut(importedExchangeRates);
      await ensureHistoricalExchangeRates('mep');
      await ensureHistoricalExchangeRates('ccl');

      // Convert all transaction prices to ARS
      const convertedTransactions: Transaction[] = [];
      if (transactions.length > 0) {
        for (const tx of transactions) {
          const t = tx as Record<string, unknown>;
          const normalized = await convertTransactionToArs(
            t.date as string,
            Number(t.price),
            Number(t.fees ?? 0),
            (t.currency as string) || 'ARS'
          );
          convertedTransactions.push({
            ...t,
            price: normalized.price,
            fees: normalized.fees,
            currency: normalized.currency,
            createdAt: (t.createdAt as string | undefined) ?? (t.date as string),
            updatedAt: (t.updatedAt as string | undefined) ?? new Date().toISOString(),
          } as Transaction);
        }
      }

      await db.transaction('rw', [db.transactions, db.accounts, db.portfolioHistory, db.historicalPrices, db.preferences], async () => {
        await db.transactions.clear();
        await db.accounts.clear();
        await db.portfolioHistory.clear();
        if (normalizedAccounts.length > 0) await db.accounts.bulkPut(normalizedAccounts);
        if (convertedTransactions.length > 0) await db.transactions.bulkPut(convertedTransactions);
        if (importedHistoricalPrices.length > 0) await db.historicalPrices.bulkPut(importedHistoricalPrices);
        if (importedPreferences.length > 0) await db.preferences.bulkPut(importedPreferences);
      });

      // Batch-compute realized P&L for all sells using FIFO
      await updateAllRealizedPnl();

      // Import income entries if present
      if (user && Array.isArray(data.incomeEntries) && data.incomeEntries.length > 0) {
        const incomeToInsert = data.incomeEntries.map((entry: IncomeEntry) => ({
          ...entry,
          user_id: user.id,
          id: undefined, // Let Supabase generate new IDs
        }));
        await supabase.from('income_entries').insert(incomeToInsert);
      }

      // Import expenses if present (only if user has a household)
      if (user && Array.isArray(data.expenses) && data.expenses.length > 0) {
        const { data: participantData } = await supabase
          .from('participants')
          .select('household_id')
          .eq('user_id', user.id)
          .single();

        if (participantData) {
          const expensesToInsert = data.expenses.map((expense: Expense) => ({
            ...expense,
            household_id: participantData.household_id,
            created_by: user.id,
            id: undefined, // Let Supabase generate new IDs
          }));
          await supabase.from('expenses').insert(expensesToInsert);
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
        await db.transaction('rw', db.transactions, async () => {
          for (const tx of result.transactions) {
            await addTransaction(tx);
          }
        });
        await updateAllRealizedPnl();
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
