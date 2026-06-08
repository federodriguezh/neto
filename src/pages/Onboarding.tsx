import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Cloud, Smartphone, ArrowRight, FileSpreadsheet, BookOpen, DollarSign, Users } from 'lucide-react';
import { useTranslation } from '../i18n';
import { setPreference } from '../db';

const CSV_TEMPLATE = `date,account,symbol,assetClass,type,quantity,price,fees,currency
2024-01-15,MyBroker,GGAL,arg_stocks,buy,100,2500.50,12.63,ARS
2024-02-20,MyBroker,GGAL,arg_stocks,sell,50,2800.00,7.42,ARS`;

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleDismiss = useCallback(async () => {
    await setPreference('onboardingDismissed', true);
    navigate('/', { replace: true });
  }, [navigate]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neto-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-emerald-400" />
        <h1 className="text-2xl font-bold text-slate-100">{t('onboarding.title')}</h1>
      </div>

      {/* Welcome */}
      <div className="rounded-xl bg-slate-800 p-5">
        <p className="text-sm text-slate-300 leading-relaxed">{t('onboarding.welcome')}</p>
      </div>

      {/* Portfolio Tracking */}
      <div className="rounded-xl bg-slate-800 p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-200">{t('onboarding.portfolio.title')}</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{t('onboarding.portfolio.body')}</p>
      </div>

      {/* CSV Import */}
      <div className="rounded-xl bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={18} className="text-emerald-400" />
          <h2 className="text-lg font-semibold text-slate-200">{t('onboarding.csv.title')}</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{t('onboarding.csv.body')}</p>
        <div className="rounded-lg bg-slate-900 p-3 mb-4 overflow-x-auto">
          <code className="text-xs text-slate-400 font-mono whitespace-pre">{t('onboarding.csv.columns')}</code>
        </div>
        <p className="text-xs text-slate-500 mb-4">{t('onboarding.csv.note')}</p>
        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Download size={16} />
          {t('onboarding.csv.downloadTemplate')}
        </button>
      </div>

      {/* Income Tracking */}
      <div className="rounded-xl bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={18} className="text-emerald-400" />
          <h2 className="text-lg font-semibold text-slate-200">{t('onboarding.income.title')}</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{t('onboarding.income.body')}</p>
      </div>

      {/* Shared Expenses */}
      <div className="rounded-xl bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-sky-400" />
          <h2 className="text-lg font-semibold text-slate-200">{t('onboarding.households.title')}</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{t('onboarding.households.body')}</p>
        <ul className="text-sm text-slate-400 space-y-2 ml-4">
          <li>{t('onboarding.households.feature1')}</li>
          <li>{t('onboarding.households.feature2')}</li>
          <li>{t('onboarding.households.feature3')}</li>
        </ul>
      </div>

      {/* Cloud Sync */}
      <div className="rounded-xl bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cloud size={18} className="text-sky-400" />
          <h2 className="text-lg font-semibold text-slate-200">{t('onboarding.sync.title')}</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{t('onboarding.sync.supabase.body')}</p>
        <ul className="text-sm text-slate-400 space-y-2 ml-4">
          <li>{t('onboarding.sync.supabase.feature1')}</li>
          <li>{t('onboarding.sync.supabase.feature2')}</li>
          <li>{t('onboarding.sync.supabase.feature3')}</li>
        </ul>
      </div>

      {/* Single Device */}
      <div className="rounded-xl bg-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone size={18} className="text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-200">{t('onboarding.singleDevice.title')}</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{t('onboarding.singleDevice.body')}</p>
      </div>

      {/* Dismiss */}
      <div className="flex justify-end">
        <button
          onClick={handleDismiss}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          {t('onboarding.dismiss')}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
