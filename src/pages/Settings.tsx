import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, AlertTriangle, RotateCcw, Cloud, BookOpen, Globe, LogOut, User } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import { useAuth } from '../contexts/AuthContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTranslation } from '../i18n';
import { db, clearPriceCache, clearExchangeRates, setPreference } from '../db';
import { supabase } from '../lib/supabase';
import ImportExport from '../components/ImportExport';

export default function SettingsPage() {
  const { t, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const { accounts, create, update, remove } = useAccounts();
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  const { user, signOut } = useAuth();
  const { isOnline, pendingCount } = useSyncStatus();
  const [newAccountName, setNewAccountName] = useState('');
  const [newFeeType, setNewFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [newFeeValue, setNewFeeValue] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);
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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await Promise.all([
            supabase.from('accounts').delete().eq('user_id', user.id),
            supabase.from('transactions').delete().eq('user_id', user.id),
            supabase.from('income_entries').delete().eq('user_id', user.id),
            supabase.from('preferences').delete().eq('user_id', user.id),
            supabase.from('portfolio_history').delete().eq('user_id', user.id),
            supabase.from('sync_queue').delete().eq('user_id', user.id),
          ]);
        }
      } catch { /* ignore network errors */ }
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
    window.location.href = '/#/onboarding';
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>

      {/* Account */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('settings.account')}</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700">
              <User size={20} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">{user?.email}</p>
              <p className="text-xs text-slate-400">
                {isOnline ? t('settings.online') : t('settings.offline')}
                {pendingCount > 0 && ` · ${pendingCount} ${t('settings.pendingChanges')}`}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
          >
            <LogOut size={16} />
            {t('settings.logout')}
          </button>
        </div>
      </div>

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

      {/* Cloud Sync */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-200">{t('sync.title')}</h2>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">{t('sync.supabase.description')}</p>

          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              isOnline
                ? 'bg-emerald-900/30 text-emerald-400'
                : 'bg-rose-900/30 text-rose-400'
            }`}>
              <Cloud size={16} />
              {isOnline ? t('sync.supabase.connected') : t('sync.supabase.offline')}
            </div>
            {pendingCount > 0 && (
              <span className="text-xs text-amber-400">
                {pendingCount} {t('sync.supabase.pendingChanges')}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500">{t('sync.supabase.autoSync')}</p>
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
