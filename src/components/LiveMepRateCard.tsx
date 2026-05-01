import { useLiveExchangeRate } from '../hooks/useLiveExchangeRate';
import { formatCurrency } from '../utils/currency';

export default function LiveMepRateCard() {
  const { rate, loading } = useLiveExchangeRate('mep');

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 border border-slate-700">
      <span className="text-xs font-medium text-slate-400">Dólar MEP</span>
      <span className="text-sm font-bold text-slate-100">
        {loading || rate === null ? '—' : formatCurrency(rate, 'MEP')}
      </span>
    </div>
  );
}
