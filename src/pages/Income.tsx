import { useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { useIncome } from '../hooks/useIncome';
import { useHouseholds } from '../hooks/useHouseholds';
import { useTranslation } from '../i18n';
import { formatCurrency } from '../utils/currency';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';
import type { IncomeCategory } from '../types';

const CATEGORIES: IncomeCategory[] = ['salary', 'freelance', 'investment', 'gift', 'other'];

export default function IncomePage() {
  const { t } = useTranslation();
  const { displayCurrency } = useDisplayCurrency();
  const { entries, loading, addEntry, updateEntry, deleteEntry, getMonthlyTotal } = useIncome();
  const { participants } = useHouseholds();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('');
  const [category, setCategory] = useState<IncomeCategory>('salary');
  const [amount, setAmount] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setSource('');
    setCategory('salary');
    setAmount('');
    setParticipantId('');
    setNotes('');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const entry = {
      date,
      source,
      category,
      amount: parseFloat(amount),
      currency: 'ARS',
      participantId: participantId || undefined,
      notes: notes || undefined,
    };

    try {
      if (editingId) {
        await updateEntry(editingId, entry);
      } else {
        await addEntry(entry);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save income entry:', error);
    }
  };

  const handleEdit = (entry: typeof entries[0]) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setSource(entry.source);
    setCategory(entry.category);
    setAmount(entry.amount.toString());
    setParticipantId(entry.participantId || '');
    setNotes(entry.notes || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('income.deleteConfirm'))) {
      await deleteEntry(id);
    }
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthlyTotal = getMonthlyTotal(currentYear, currentMonth);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('income.title')}</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus size={16} />
            {t('income.add')}
          </button>
        )}
      </div>

      {/* Summary Card */}
      <div className="rounded-xl bg-slate-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={20} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-slate-200">{t('income.monthlyTotal')}</h2>
        </div>
        <p className="text-2xl font-bold text-emerald-400">
          {formatCurrency(monthlyTotal, displayCurrency)}
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-slate-800 p-4 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {editingId ? t('income.edit') : t('income.add')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('income.date')}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('income.source')}
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t('income.sourcePlaceholder')}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('income.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IncomeCategory)}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {t(`income.category.${cat}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('income.amount')}
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            {participants.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('income.participant')}
                </label>
                <select
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">{t('income.selectParticipant')}</option>
                  {participants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('income.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('income.notesPlaceholder')}
                rows={2}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              {editingId ? t('income.update') : t('income.save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
            >
              {t('income.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Entries List */}
      <div className="rounded-xl bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('income.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('income.empty')}</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {entries.map(entry => (
              <div key={entry.id} className="p-4 hover:bg-slate-750 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-100">{entry.source}</h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                        {t(`income.category.${entry.category}`)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{entry.date}</p>
                    {entry.notes && (
                      <p className="text-sm text-slate-500 mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">
                      {formatCurrency(entry.amount, displayCurrency)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label={t('income.edit')}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-slate-400 hover:text-rose-400 transition-colors"
                        aria-label={t('income.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
