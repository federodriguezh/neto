import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, RotateCcw, Cloud, CloudOff, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { useSync } from '../hooks/useSync';
import { db, clearPriceCache, clearExchangeRates } from '../db';
import ImportExport from '../components/ImportExport';

export default function SettingsPage() {
  const { accounts, create, update, remove } = useAccounts();
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  const sync = useSync();
  const [newAccountName, setNewAccountName] = useState('');
  const [newFeeType, setNewFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [newFeeValue, setNewFeeValue] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingFeeType, setEditingFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [editingFeeValue, setEditingFeeValue] = useState('0');

  const [patInput, setPatInput] = useState(sync.pat);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [confirmPassphraseInput, setConfirmPassphraseInput] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  useEffect(() => {
    if (sync.pat && !patInput) {
      setPatInput(sync.pat);
    }
  }, [sync.pat, patInput]);

  const handleCreate = async () => {
    if (!newAccountName.trim()) return;
    await create(newAccountName.trim(), newFeeType, Number(newFeeValue));
    setNewAccountName('');
    setNewFeeType('fixed');
    setNewFeeValue('0');
  };

  const handleUpdate = async (id: string) => {
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

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">Encrypted Cloud Sync</h2>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            Sync your portfolio across devices using a private GitHub Gist.
            Your data is encrypted with a passphrase before leaving this device.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (sync.enabled) {
                  await sync.setEnabled(false);
                } else {
                  await sync.setEnabled(true);
                }
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sync.enabled
                  ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {sync.enabled ? <Cloud size={16} /> : <CloudOff size={16} />}
              {sync.enabled ? 'Sync Enabled' : 'Sync Disabled'}
            </button>
            {sync.lastSyncAt && (
              <span className="text-xs text-slate-500">
                Last synced: {new Date(sync.lastSyncAt).toLocaleString()}
              </span>
            )}
          </div>

          {sync.status === 'error' && sync.error && (
            <div className="rounded-lg bg-rose-900/30 border border-rose-800 px-3 py-2 text-xs text-rose-300">
              {sync.error}
            </div>
          )}

          {sync.status === 'syncing' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw size={14} className="animate-spin" />
              Syncing...
            </div>
          )}

          {sync.status === 'success' && (
            <div className="text-xs text-emerald-400">Sync successful</div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400">GitHub Personal Access Token</label>
            <div className="flex gap-2">
              <input
                type={showPat ? 'text' : 'password'}
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder="ghp_..."
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
              />
              <button
                onClick={() => setShowPat((s) => !s)}
                className="rounded-lg bg-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {showPat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-500">Requires the <code className="text-slate-400">gist</code> scope.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400">Sync Passphrase</label>
            <div className="flex gap-2">
              <input
                type={showPassphrase ? 'text' : 'password'}
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder="Min 8 characters"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
              />
              <button
                onClick={() => setShowPassphrase((s) => !s)}
                className="rounded-lg bg-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!sync.passphrase && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-400">Confirm Passphrase</label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder="Repeat passphrase"
                value={confirmPassphraseInput}
                onChange={(e) => setConfirmPassphraseInput(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!sync.enabled ? (
              <button
                onClick={async () => {
                  if (!patInput.trim()) {
                    alert('Please enter a GitHub Personal Access Token.');
                    return;
                  }
                  if (passphraseInput.length < 8) {
                    alert('Passphrase must be at least 8 characters.');
                    return;
                  }
                  if (!sync.passphrase && passphraseInput !== confirmPassphraseInput) {
                    alert('Passphrases do not match.');
                    return;
                  }
                  await sync.setPat(patInput.trim());
                  await sync.setPassphrase(passphraseInput);
                  await sync.setEnabled(true);
                  await sync.syncNow();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                <Cloud size={16} />
                Enable Sync
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    await sync.setPat(patInput.trim());
                    await sync.setPassphrase(passphraseInput || sync.passphrase);
                    await sync.syncNow();
                  }}
                  disabled={sync.status === 'syncing'}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  Sync Now
                </button>
                <button
                  onClick={async () => {
                    if (confirm('This will disable sync and remove your saved passphrase from this device. The encrypted Gist will remain on GitHub. Continue?')) {
                      await sync.unlink();
                      setPatInput('');
                      setPassphraseInput('');
                      setConfirmPassphraseInput('');
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
                >
                  <CloudOff size={16} />
                  Unlink
                </button>
              </>
            )}
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
          >
            <AlertTriangle size={16} />
            Clear All Data
          </button>
          {localStorage.getItem('neto-pre-v4-backup') && (
            <button
              onClick={() => {
                if (confirm('Delete the pre-v4 database backup from localStorage? This cannot be undone.')) {
                  localStorage.removeItem('neto-pre-v4-backup');
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
            >
              <Trash2 size={16} />
              Delete v3 Backup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
