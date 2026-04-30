import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from '../db';
import type { Transaction } from '../types';
import TransactionForm from '../components/TransactionForm';

export default function TransactionsPage() {
  const { accounts } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getTransactions();
    setTransactions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (tx: Omit<Transaction, 'id'>) => {
    await addTransaction(tx);
    await refresh();
    setShowForm(false);
  };

  const handleUpdate = async (tx: Omit<Transaction, 'id'>) => {
    if (editing?.id !== undefined) {
      await updateTransaction(editing.id, tx);
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
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
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
                <td className="px-4 py-3 text-slate-300">${tx.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-slate-300">${tx.fees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
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
            ))}
            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
