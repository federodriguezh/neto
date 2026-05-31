import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, RotateCcw, Cloud, CloudOff, Eye, EyeOff, RefreshCw, BookOpen, Globe } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { useSync } from '../hooks/useSync';
import { useTranslation } from '../i18n';
import { db, clearPriceCache, clearExchangeRates, setPreference } from '../db';
import ImportExport from '../components/ImportExport';

export default function SettingsPage() {
  const { t, setLanguage } = useTranslation();
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
    if (confirm(t('settings.clearAll') + ' — ' + t('misc.confirm'))) {
      await db.delete();
      localStorage.removeItem('neto-sync-passphrase');
      localStorage.removeItem('neto-pre-v4-backup');
      window.location.reload();
    }
  };

  const handleClearPriceCache = async () => {
    if (confirm(t('settings.clearPriceCache') + '?')) {
      await clearPriceCache();
      alert(t('settings.clearPriceCache'));
    }
  };

  const handleShowOnboarding = async () => {
    await setPreference('onboardingDismissed', false);
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>

      {/* Accounts */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('settings.accounts')}</h2>
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              placeholder={t('settings.newAccount')}
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus size={16} />
              {t('settings.add')}
            </button>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              value={newFeeType}
              onChange={(e) => setNewFeeType(e.target.value as 'fixed' | 'percentage')}
            >
              <option value="fixed">{t('settings.fixedFee')}</option>
              <option value="percentage">{t('settings.percentageFee')}</option>
            </select>
            <input
              type="number"
              min="0"
              step="any"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
              placeholder={newFeeType === 'fixed' ? t('settings.fixedPlaceholder') : t('settings.percentagePlaceholder')}
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
                      {t('settings.save')}
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditingName(''); setEditingFeeType('fixed'); setEditingFeeValue('0'); }}
                      className="text-xs font-medium text-slate-400 hover:text-slate-300"
                    >
                      {t('settings.cancel')}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 border border-slate-700"
                      value={editingFeeType}
                      onChange={(e) => setEditingFeeType(e.target.value as 'fixed' | 'percentage')}
                    >
                      <option value="fixed">{t('settings.fixedFee')}</option>
                      <option value="percentage">{t('settings.percentageFee')}</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="flex-1 rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 border border-slate-700"
                      placeholder={editingFeeType === 'fixed' ? t('settings.fixedPlaceholder') : t('settings.percentagePlaceholder')}
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
                      {account.feeType === 'fixed' ? t('settings.fixedFeeValue', { value: String(account.feeValue) }) : `${account.feeValue}%`}
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
                      aria-label={t('settings.editAccount')}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => account.id !== undefined && remove(account.id)}
                      aria-label={t('settings.deleteAccount')}
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
            <div className="text-sm text-slate-500">{t('settings.noAccounts')}</div>
          )}
        </div>
      </div>

      {/* Display Currency */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('settings.displayCurrency')}</h2>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-400">
            {t('settings.currencyDescription', { currency: displayCurrency === 'MEP' ? 'MEP (Bolsa)' : displayCurrency === 'CCL' ? 'CCL (Contado con Liqui)' : 'ARS' })}
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
                {c === 'ARS' ? t('settings.ars') : c === 'MEP' ? t('settings.mep') : t('settings.ccl')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-xl bg-slate-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-slate-400" />
          <h2 className="text-sm font-medium text-slate-200">{t('settings.language')}</h2>
        </div>
        <p className="text-xs text-slate-400 mb-2">{t('settings.languageDescription')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('en')}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {t('settings.english')}
          </button>
          <button
            onClick={() => setLanguage('es')}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            {t('settings.spanish')}
          </button>
        </div>
      </div>

      {/* Sync */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('sync.title')}</h2>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">{t('sync.description')}</p>

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
              {sync.enabled ? t('sync.enabled') : t('sync.disabled')}
            </button>
            {sync.lastSyncAt && (
              <span className="text-xs text-slate-500">
                {t('sync.lastSynced', { time: new Date(sync.lastSyncAt).toLocaleString() })}
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
              {t('sync.syncing')}
            </div>
          )}

          {sync.status === 'success' && (
            <div className="text-xs text-emerald-400">{t('sync.success')}</div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400">{t('sync.pat')}</label>
            <div className="flex gap-2">
              <input
                type={showPat ? 'text' : 'password'}
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder={t('sync.patPlaceholder')}
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
              />
              <button
                onClick={() => setShowPat((s) => !s)}
                aria-label={showPat ? t('sync.hidePat') : t('sync.showPat')}
                className="rounded-lg bg-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {showPat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-500">{t('sync.patScope', { scope: 'gist' })}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400">{t('sync.passphrase')}</label>
            <div className="flex gap-2">
              <input
                type={showPassphrase ? 'text' : 'password'}
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder={t('sync.passphrasePlaceholder')}
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
              />
              <button
                onClick={() => setShowPassphrase((s) => !s)}
                aria-label={showPassphrase ? t('sync.hidePassphrase') : t('sync.showPassphrase')}
                className="rounded-lg bg-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!sync.passphrase && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-400">{t('sync.confirmPassphrase')}</label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700"
                placeholder={t('sync.confirmPlaceholder')}
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
                    alert(t('sync.error.patRequired'));
                    return;
                  }
                  if (passphraseInput.length < 8) {
                    alert(t('sync.error.passphraseLength'));
                    return;
                  }
                  if (!sync.passphrase && passphraseInput !== confirmPassphraseInput) {
                    alert(t('sync.error.passphraseMatch'));
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
                {t('sync.enable')}
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
                  {t('sync.syncNow')}
                </button>
                <button
                  onClick={async () => {
                    if (confirm(t('sync.unlinkConfirm'))) {
                      await sync.unlink();
                      setPatInput('');
                      setPassphraseInput('');
                      setConfirmPassphraseInput('');
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
                >
                  <CloudOff size={16} />
                  {t('sync.unlink')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <ImportExport />

      {/* Data Maintenance */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('settings.dataMaintenance')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleClearPriceCache}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={16} />
            {t('settings.clearPriceCache')}
          </button>
          <button
            onClick={async () => {
              if (confirm(t('settings.clearExchangeRates') + '?')) {
                await clearExchangeRates();
                alert(t('settings.clearExchangeRates'));
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <RotateCcw size={16} />
            {t('settings.clearExchangeRates')}
          </button>
          <button
            onClick={handleShowOnboarding}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <BookOpen size={16} />
            {t('settings.showOnboarding')}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('settings.dangerZone')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
          >
            <AlertTriangle size={16} />
            {t('settings.clearAll')}
          </button>
          {localStorage.getItem('neto-pre-v4-backup') && (
            <button
              onClick={() => {
                if (confirm(t('settings.deleteV3Backup') + ' — ' + t('misc.confirm'))) {
                  localStorage.removeItem('neto-pre-v4-backup');
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-900/50 transition-colors"
            >
              <Trash2 size={16} />
              {t('settings.deleteV3Backup')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
