import { ArrowRight, Scale, CheckCircle } from 'lucide-react';
import { useBalances } from '../hooks/useBalances';
import { useHouseholds } from '../hooks/useHouseholds';
import { useTranslation } from '../i18n';
import { formatCurrency } from '../utils/currency';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';

export default function BalancesPage() {
  const { t } = useTranslation();
  const { displayCurrency } = useDisplayCurrency();
  const { household } = useHouseholds();
  const { balances, debts, loading, getTotalSettled, getTotalPending, isBalanced } = useBalances();

  if (!household) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('balances.title')}</h1>
        <div className="rounded-xl bg-slate-800 p-8 text-center">
          <Scale size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-300">{t('balances.noHousehold')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">{t('balances.loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-100">{t('balances.title')}</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={20} className="text-emerald-400" />
            <h2 className="text-sm font-medium text-slate-200">{t('balances.totalSettled')}</h2>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(getTotalSettled(), displayCurrency)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Scale size={20} className="text-amber-400" />
            <h2 className="text-sm font-medium text-slate-200">{t('balances.totalPending')}</h2>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(getTotalPending(), displayCurrency)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Scale size={20} className={isBalanced() ? 'text-emerald-400' : 'text-rose-400'} />
            <h2 className="text-sm font-medium text-slate-200">{t('balances.status')}</h2>
          </div>
          <p className={`text-lg font-bold ${isBalanced() ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isBalanced() ? t('balances.balanced') : t('balances.unbalanced')}
          </p>
        </div>
      </div>

      {/* Individual Balances */}
      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-200 mb-4">{t('balances.individualBalances')}</h2>
        <div className="space-y-3">
          {balances.map(balance => (
            <div key={balance.participantId} className="rounded-lg bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-100">{balance.participantName}</h3>
                <span className={`text-lg font-bold ${
                  balance.netBalance > 0.01 ? 'text-emerald-400' :
                  balance.netBalance < -0.01 ? 'text-rose-400' :
                  'text-slate-400'
                }`}>
                  {balance.netBalance > 0.01 ? '+' : ''}
                  {formatCurrency(balance.netBalance, displayCurrency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 mb-1">{t('balances.totalPaid')}</p>
                  <p className="font-medium text-slate-200">
                    {formatCurrency(balance.totalPaid, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">{t('balances.totalOwed')}</p>
                  <p className="font-medium text-slate-200">
                    {formatCurrency(balance.totalOwed, displayCurrency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debts */}
      {debts.length > 0 && (
        <div className="rounded-xl bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-200 mb-4">{t('balances.whoOwesWhom')}</h2>
          <div className="space-y-3">
            {debts.map((debt, index) => (
              <div key={index} className="rounded-lg bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium text-slate-100">{debt.fromParticipantName}</span>
                    <ArrowRight size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-100">{debt.toParticipantName}</span>
                  </div>
                  <span className="text-lg font-bold text-rose-400">
                    {formatCurrency(debt.amount, displayCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isBalanced() && debts.length === 0 && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-800 p-6 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
          <p className="text-emerald-300 font-medium">{t('balances.allSettled')}</p>
        </div>
      )}
    </div>
  );
}
