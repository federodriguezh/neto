import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, getExchangeRatesForType } from '../db';
import type { Transaction, ExchangeRate } from '../types';
import TransactionForm from '../components/TransactionForm';
import { calculateRealizedPnl } from '../utils/realizedPnl';
import { convertArsToUsd, formatCurrency } from '../utils/currency';

function buildRateMap(rates: ExchangeRate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rates) {
    map.set(r.date, r.rate);
  }
  return map;
}

function getRateWithFallback(map: Map<string, number>, targetDate: string, sortedRates: ExchangeRate[]): number | undefined {
  const exact = map.get(targetDate);
  if (exact !== undefined) return exact;

  const before = sortedRates.filter((r) => r.date < targetDate);
  if (before.length > 0) return before[before.length - 1].rate;

  const after = sortedRates.filter((r) => r.date > targetDate);
  if (after.length > 0) return after[0].rate;

  return undefined;
}

export default function TransactionsPage() {
  const { accounts } = useAccounts();
  const { displayCurrency } = useDisplayCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const isUsd = displayCurrency !== 'ARS';
  const rateType = displayCurrency === 'MEP' ? 'mep' : displayCurrency === 'CCL' ? 'ccl' : null;

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getTransactions();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    async function loadRates() {
      if (!rateType || transactions.length === 0) {
        setExchangeRates([]);
        return;
      }
      const dates = transactions.map((t) => t.date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));
      const rates = await getExchangeRatesForType(rateType, minDate, maxDate);
      setExchangeRates(rates);
    }
    loadRates();
  }, [rateType, transactions]);

  const rateMap = useMemo(() => buildRateMap(exchangeRates), [exchangeRates]);

  const handleAdd = async (tx: Omit<Transaction, 'id'>) => {
    let txToSave: Omit<Transaction, 'id'> = tx;
    if (tx.type === 'sell') {
      const allTxs = await getTransactions();
      const pnl = calculateRealizedPnl(tx as Transaction, allTxs);
      txToSave = { ...tx, realizedPnl: pnl };
    }
    await addTransaction(txToSave);
    await refresh();
    setShowForm(false);
  };

  const handleUpdate = async (tx: Omit<Transaction, 'id'>) => {
    if (editing?.id !== undefined) {
      let changes: Partial<Transaction> = tx;
      if (tx.type === 'sell') {
        const allTxs = (await getTransactions()).filter((t) => t.id !== editing.id);
        const pnl = calculateRealizedPnl({ ...tx, id: editing.id } as Transaction, allTxs);
        changes = { ...tx, realizedPnl: pnl };
      } else {
        changes = { ...tx, realizedPnl: undefined };
      }
      await updateTransaction(editing.id, changes);
      await refresh();
      setEditing(undefined);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this transaction?')) {
      await deleteTransaction(id);
      await refresh();
    }
  };

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus size={16} />
            Add Transaction
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <TransactionForm
          accounts={accounts}
          initial={editing}
          onSubmit={editing ? handleUpdate : handleAdd}
          onCancel={() => {
            setShowForm(false);
            setEditing(undefined);
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Symbol</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Fees</th>
              <th className="px-4 py-3 font-medium">Realized P&L</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const rate = isUsd ? getRateWithFallback(rateMap, tx.date, exchangeRates) : undefined;
              const priceDisplay = rate !== undefined ? convertArsToUsd(tx.price, rate) : tx.price;
              const feesDisplay = rate !== undefined ? convertArsToUsd(tx.fees, rate) : tx.fees;
              const pnlDisplay = tx.realizedPnl !== undefined && rate !== undefined
                ? convertArsToUsd(tx.realizedPnl, rate)
                : tx.realizedPnl;

              return (
                <tr key={tx.id} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-3 text-slate-300">{tx.date}</td>
                  <td className="px-4 py-3 text-slate-300">{accountMap.get(tx.accountId) ?? 'Unknown'}</td>
                  <td className="px-4 py-3 font-medium text-slate-100">{tx.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tx.type === 'buy' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'
                    }`}>
                      {tx.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{tx.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCurrency(priceDisplay, displayCurrency)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCurrency(feesDisplay, displayCurrency)}</td>
                  <td className="px-4 py-3">
                    {tx.type === 'sell' && pnlDisplay !== undefined ? (
                      <span className={`font-medium ${pnlDisplay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnlDisplay >= 0 ? '+' : ''}{formatCurrency(pnlDisplay, displayCurrency)}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditing(tx)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => tx.id !== undefined && handleDelete(tx.id)}
                        className="text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">No transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
