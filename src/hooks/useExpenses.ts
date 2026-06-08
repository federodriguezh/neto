import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useHouseholds } from './useHouseholds';
import {
  getLocalExpenses, addLocalExpense, updateLocalExpense, deleteLocalExpense,
  getLocalExpenseSplits, addLocalExpenseSplit, updateLocalExpenseSplit,
} from '../db';
import { enqueueExpenseChange, enqueueExpenseSplitChange } from '../sync/offlineQueue';
import type { Expense, ExpenseSplit } from '../types';

export function useExpenses() {
  const { user } = useAuth();
  const { household, participants } = useHouseholds();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const [localExp, localSplits] = await Promise.all([getLocalExpenses(), getLocalExpenseSplits()]);
    if (localExp.length > 0) {
      setExpenses(localExp);
      setSplits(localSplits);
    }
    setLoading(false);
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    if (!household) return;
    try {
      const { data: expData } = await supabase.from('expenses')
        .select('*').eq('household_id', household.id).is('deleted_at', null).order('date', { ascending: false });
      if (!expData?.length) return;
      setExpenses(expData.map((e) => ({
        ...e,
        totalAmount: e.total_amount,
        paidBy: e.paid_by,
        splitMethod: e.split_method,
        fixedSplit: e.fixed_split ?? undefined,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        deletedAt: e.deleted_at ?? undefined,
      })));

      const ids = expData.map((e) => e.id);
      const { data: splitData } = await supabase.from('expense_splits').select('*').in('expense_id', ids);
      setSplits((splitData || []).map((s) => ({
        ...s,
        expenseId: s.expense_id,
        participantId: s.participant_id,
        settledAt: s.settled_at ?? undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })));
    } catch {}
  }, [household]);

  useEffect(() => { loadLocal(); }, [loadLocal]);
  useEffect(() => { fetchFromSupabase(); }, [fetchFromSupabase]);

  useEffect(() => {
    const id = setInterval(() => { fetchFromSupabase().catch(() => {}); }, 60000);
    const onFocus = () => { fetchFromSupabase().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [fetchFromSupabase]);

  const calculateSplits = (
    totalAmount: number,
    splitMethod: 'proportional' | 'fixed',
    fixedSplit?: number,
  ): Omit<ExpenseSplit, 'id' | 'createdAt' | 'updatedAt'>[] => {
    if (participants.length === 0) return [];
    const result: Omit<ExpenseSplit, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    if (splitMethod === 'fixed' && fixedSplit !== undefined) {
      const remaining = 1 - fixedSplit;
      const restCount = participants.length - 1;
      participants.forEach((p, i) => {
        const share = i === 0 ? fixedSplit : remaining / restCount;
        result.push({ expenseId: '', participantId: p.id, share, amount: totalAmount * share, settled: false });
      });
    } else {
      const totalRatio = participants.reduce((sum, p) => sum + p.incomeRatio, 0);
      participants.forEach((p) => {
        const share = totalRatio > 0 ? p.incomeRatio / totalRatio : 1 / participants.length;
        result.push({ expenseId: '', participantId: p.id, share, amount: totalAmount * share, settled: false });
      });
    }
    return result;
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'household_id'>) => {
    if (!household || !user) throw new Error('No household or user');

    const fullExpense = await addLocalExpense(expense);
    setExpenses((prev) => [fullExpense, ...prev]);
    enqueueExpenseChange('INSERT', fullExpense).catch(() => {});

    const newSplits = calculateSplits(expense.totalAmount, expense.splitMethod, expense.fixedSplit);
    for (const s of newSplits) {
      const split = await addLocalExpenseSplit({ ...s, expenseId: fullExpense.id });
      enqueueExpenseSplitChange('INSERT', split).catch(() => {});
    }

    try {
      const { data: supabaseExp } = await supabase.from('expenses').insert({
        ...expense, household_id: household.id, created_by: user.id,
      }).select().single();
      if (supabaseExp) {
        const splitsToCreate = calculateSplits(expense.totalAmount, expense.splitMethod, expense.fixedSplit)
          .map((s) => ({ ...s, expense_id: supabaseExp.id }));
        if (splitsToCreate.length > 0) await supabase.from('expense_splits').insert(splitsToCreate);
      }
    } catch {}
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    await updateLocalExpense(id, updates);
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    const current = expenses.find((e) => e.id === id);
    if (current) enqueueExpenseChange('UPDATE', { ...current, ...updates }).catch(() => {});

    try {
      await supabase.from('expenses').update(updates).eq('id', id);
      if (updates.totalAmount !== undefined || updates.splitMethod !== undefined || updates.fixedSplit !== undefined) {
        await supabase.from('expense_splits').delete().eq('expense_id', id);
        const expense = expenses.find((e) => e.id === id);
        if (expense) {
          const splitsToCreate = calculateSplits(
            updates.totalAmount ?? expense.totalAmount,
            updates.splitMethod ?? expense.splitMethod,
            updates.fixedSplit ?? expense.fixedSplit,
          ).map((s) => ({ ...s, expense_id: id }));
          if (splitsToCreate.length > 0) await supabase.from('expense_splits').insert(splitsToCreate);
        }
      }
    } catch {}
  };

  const deleteExpense = async (id: string) => {
    await deleteLocalExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const current = expenses.find((e) => e.id === id);
    if (current) enqueueExpenseChange('DELETE', current).catch(() => {});

    try {
      await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    } catch {}
  };

  const settleSplit = async (splitId: string) => {
    await updateLocalExpenseSplit(splitId, { settled: true, settledAt: new Date().toISOString() });
    setSplits((prev) => prev.map((s) => (s.id === splitId ? { ...s, settled: true, settledAt: new Date().toISOString() } : s)));
    enqueueExpenseSplitChange('UPDATE', { ...splits.find((s) => s.id === splitId)!, settled: true, settledAt: new Date().toISOString() }).catch(() => {});

    try {
      await supabase.from('expense_splits').update({ settled: true, settled_at: new Date().toISOString() }).eq('id', splitId);
    } catch {}
  };

  const getMonthlyTotal = (year: number, month: number) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return expenses.filter((e) => e.date.startsWith(prefix)).reduce((sum, e) => sum + e.totalAmount, 0);
  };

  const getByCategory = (category: string) => expenses.filter((e) => e.category === category);
  const getSplitsForExpense = (expenseId: string) => splits.filter((s) => s.expenseId === expenseId);
  const getSplitsForParticipant = (participantId: string) => splits.filter((s) => s.participantId === participantId);

  return {
    expenses, splits, loading, error: null,
    addExpense, updateExpense, deleteExpense, settleSplit,
    getMonthlyTotal, getByCategory, getSplitsForExpense, getSplitsForParticipant, refetch: loadLocal,
  };
}
