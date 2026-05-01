import { useState } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { db, clearPriceCache, clearExchangeRates } from '../db';
import ImportExport from '../components/ImportExport';

export default function SettingsPage() {
  const { accounts, create, update, remove } = useAccounts();
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  const [newAccountName, setNewAccountName] = useState('');
  const [newFeeType, setNewFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [newFeeValue, setNewFeeValue] = useState('0');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingFeeType, setEditingFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [editingFeeValue, setEditingFeeValue] = useState('0');

  const handleCreate = async () => {
    if (!newAccountName.trim()) return;
    await create(newAccountName.trim(), newFeeType, Number(newFeeValue));
    setNewAccountName('');
    setNewFeeType('fixed');
    setNewFeeValue('0');
  };

  const handleUpdate = async (id: number) => {
    if (!editingName.trim()) return;
    await update(id, { name: editingName.trim(), feeType: editingFeeType, feeValue: Number(editingFeeValue) });
    setEditingId(null);
    setEditingName('');
    setEditingFeeType('fixed');
    setEditingFeeValue('0');
  };

  const handleClearAll = async () => {
    if (confirm('WARNING: This will permanently delete ALL data. Are you sure?')) {
      await db.delete();
      window.location.reload();
    }
  };

  const handleClearPriceCache = async () => {
    if (confirm('This will clear the cached live prices. Prices will be re-fetched on next refresh. Continue?')) {
      await clearPriceCache();
      alert('Price cache cleared.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Accounts</h2>
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              placeholder="New account name"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              value={newFeeType}
              onChange={(e) => setNewFeeType(e.target.value as 'fixed' | 'percentage')}
            >
              <option value="fixed">Fixed Fee (ARS)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
            <input
              type="number"
              min="0"
              step="any"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              placeholder={newFeeType === 'fixed' ? 'Fixed amount in ARS' : 'Percentage (e.g. 0.5)'}
              value={newFeeValue}
              onChange={(e) => setNewFeeValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2"
            >
              {editingId === account.id ? (
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 border border-slate-700"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && account.id !== undefined && handleUpdate(account.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => account.id !== undefined && handleUpdate(account.id)}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditingName(''); setEditingFeeType('fixed'); setEditingFeeValue('0'); }}
                      className="text-xs font-medium text-slate-400 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 border border-slate-700"
                      value={editingFeeType}
                      onChange={(e) => setEditingFeeType(e.target.value as 'fixed' | 'percentage')}
                    >
                      <option value="fixed">Fixed Fee (ARS)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 border border-slate-700"
                      placeholder={editingFeeType === 'fixed' ? 'Fixed amount in ARS' : 'Percentage (e.g. 0.5)'}
                      value={editingFeeValue}
                      onChange={(e) => setEditingFeeValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && account.id !== undefined && handleUpdate(account.id)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-200">{account.name}</span>
                    <span className="text-xs text-slate-500">
                      {account.feeType === 'fixed' ? `$${account.feeValue} fixed` : `${account.feeValue}%`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(account.id ?? null);
                        setEditingName(account.name);
                        setEditingFeeType(account.feeType);
                        setEditingFeeValue(account.feeValue.toString());
                      }}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => account.id !== undefined && remove(account.id)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="text-sm text-slate-500">No accounts yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Display Currency</h2>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-400">
            Choose how portfolio values are displayed. Historical conversions use Dólar {displayCurrency === 'MEP' ? 'MEP (Bolsa)' : displayCurrency === 'CCL' ? 'CCL (Contado con Liqui)' : 'ARS'} venta rate.
          </p>
          <div className="flex gap-2">
            {(['ARS', 'MEP', 'CCL'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setDisplayCurrency(c)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  displayCurrency === c
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {c === 'ARS' ? 'ARS ($)' : c === 'MEP' ? 'USD (MEP)' : 'USD (CCL)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ImportExport />

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Data Maintenance</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleClearPriceCache}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={16} />
            Clear Price Cache
          </button>
          <button
            onClick={async () => {
              if (confirm('This will clear cached exchange rate history. Rates will be re-fetched on next use. Continue?')) {
                await clearExchangeRates();
                alert('Exchange rate cache cleared.');
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={16} />
            Clear Exchange Rate Cache
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Danger Zone</h2>
        <button
          onClick={handleClearAll}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
        >
          <AlertTriangle size={16} />
          Clear All Data
        </button>
      </div>
    </div>
  );
}
