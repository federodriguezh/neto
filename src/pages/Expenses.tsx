import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Receipt } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useHouseholds } from '../hooks/useHouseholds';
import { useTranslation } from '../i18n';
import { formatCurrency } from '../utils/currency';
import { useDisplayCurrency } from '../hooks/useDisplayCurrency';

const CATEGORIES = ['groceries', 'utilities', 'rent', 'transport', 'entertainment', 'health', 'other'];

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { displayCurrency } = useDisplayCurrency();
  const { household, participants } = useHouseholds();
  const { expenses, loading, addExpense, updateExpense, deleteExpense, settleSplit, getSplitsForExpense } = useExpenses();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('groceries');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitMethod, setSplitMethod] = useState<'proportional' | 'fixed'>('proportional');
  const [fixedSplit, setFixedSplit] = useState('50');

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setCategory('groceries');
    setTotalAmount('');
    setPaidBy(participants[0]?.id || '');
    setSplitMethod('proportional');
    setFixedSplit('50');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const expense = {
      date,
      description,
      category,
      totalAmount: parseFloat(totalAmount),
      currency: 'ARS',
      paidBy,
      splitMethod,
      fixedSplit: splitMethod === 'fixed' ? parseFloat(fixedSplit) / 100 : undefined,
    };

    try {
      if (editingId) {
        await updateExpense(editingId, expense);
      } else {
        await addExpense(expense);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const handleEdit = (expense: typeof expenses[0]) => {
    setEditingId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setCategory(expense.category);
    setTotalAmount(expense.totalAmount.toString());
    setPaidBy(expense.paidBy);
    setSplitMethod(expense.splitMethod);
    if (expense.fixedSplit !== undefined) {
      setFixedSplit((expense.fixedSplit * 100).toString());
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('expenses.deleteConfirm'))) {
      await deleteExpense(id);
    }
  };

  const handleSettle = async (splitId: string) => {
    await settleSplit(splitId);
  };

  const getParticipantName = (id: string) => {
    return participants.find(p => p.id === id)?.name || 'Unknown';
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthlyTotal = expenses
    .filter(e => e.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`))
    .reduce((sum, e) => sum + e.totalAmount, 0);

  if (!household) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-100">{t('expenses.title')}</h1>
        <div className="rounded-xl bg-slate-800 p-8 text-center">
          <Receipt size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-300">{t('expenses.noHousehold')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{t('expenses.title')}</h1>
        {!showForm && (
          <button
            onClick={() => {
              setPaidBy(participants[0]?.id || '');
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus size={16} />
            {t('expenses.add')}
          </button>
        )}
      </div>

      {/* Summary Card */}
      <div className="rounded-xl bg-slate-800 p-4">
        <div className="flex items-center gap-3 mb-2">
          <Receipt size={20} className="text-rose-400" />
          <h2 className="text-sm font-medium text-slate-200">{t('expenses.monthlyTotal')}</h2>
        </div>
        <p className="text-2xl font-bold text-rose-400">
          {formatCurrency(monthlyTotal, displayCurrency)}
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-slate-800 p-4 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-100">
            {editingId ? t('expenses.edit') : t('expenses.add')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('expenses.date')}
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
                {t('expenses.description')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('expenses.descriptionPlaceholder')}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('expenses.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {t(`expenses.category.${cat}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('expenses.totalAmount')}
              </label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('expenses.paidBy')}
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              >
                {participants.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('expenses.splitMethod')}
              </label>
              <select
                value={splitMethod}
                onChange={(e) => setSplitMethod(e.target.value as 'proportional' | 'fixed')}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                <option value="proportional">{t('expenses.proportional')}</option>
                <option value="fixed">{t('expenses.fixed')}</option>
              </select>
            </div>

            {splitMethod === 'fixed' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('expenses.fixedSplitPercentage')}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={fixedSplit}
                  onChange={(e) => setFixedSplit(e.target.value)}
                  placeholder="50"
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">{t('expenses.fixedSplitHelp')}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              {editingId ? t('expenses.update') : t('expenses.save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
            >
              {t('expenses.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Expenses List */}
      <div className="rounded-xl bg-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('expenses.loading')}</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('expenses.empty')}</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {expenses.map(expense => {
              const expenseSplits = getSplitsForExpense(expense.id);
              return (
                <div key={expense.id} className="p-4 hover:bg-slate-750 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-100">{expense.description}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
                          {t(`expenses.category.${expense.category}`)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {expense.date} · {t('expenses.paidBy')} {getParticipantName(expense.paidBy)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-rose-400">
                        {formatCurrency(expense.totalAmount, displayCurrency)}
                      </p>
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                          aria-label={t('expenses.edit')}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-slate-400 hover:text-rose-400 transition-colors"
                          aria-label={t('expenses.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Splits */}
                  <div className="mt-3 space-y-1">
                    {expenseSplits.map(split => (
                      <div key={split.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                          {getParticipantName(split.participantId)}: {formatCurrency(split.amount, displayCurrency)}
                        </span>
                        {split.settled ? (
                          <span className="text-emerald-400 text-xs">{t('expenses.settled')}</span>
                        ) : (
                          <button
                            onClick={() => handleSettle(split.id)}
                            className="text-slate-400 hover:text-emerald-400 transition-colors"
                            aria-label={t('expenses.markSettled')}
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
