import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useHouseholds } from './useHouseholds';
import type { Expense, ExpenseSplit } from '../types';

export function useExpenses() {
  const { user } = useAuth();
  const { household, participants } = useHouseholds();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!household) {
      setExpenses([]);
      setSplits([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Fetch expenses
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    
    if (expensesError) {
      setError(expensesError.message);
      setExpenses([]);
      setSplits([]);
      setLoading(false);
      return;
    }
    
    setExpenses(expensesData || []);
    
    // Fetch splits for these expenses
    if (expensesData && expensesData.length > 0) {
      const expenseIds = expensesData.map(e => e.id);
      const { data: splitsData, error: splitsError } = await supabase
        .from('expense_splits')
        .select('*')
        .in('expense_id', expenseIds);
      
      if (splitsError) {
        setError(splitsError.message);
      } else {
        setSplits(splitsData || []);
      }
    } else {
      setSplits([]);
    }
    
    setLoading(false);
  }, [household]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const calculateSplits = (
    totalAmount: number,
    splitMethod: 'proportional' | 'fixed',
    fixedSplit?: number
  ): Omit<ExpenseSplit, 'id' | 'createdAt' | 'updatedAt'>[] => {
    if (participants.length === 0) return [];
    
    const result: Omit<ExpenseSplit, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    
    if (splitMethod === 'fixed' && fixedSplit !== undefined) {
      // Fixed split: first participant gets fixedSplit%, rest split equally
      const firstShare = fixedSplit;
      const remainingShare = 1 - fixedSplit;
      const remainingParticipants = participants.length - 1;
      
      participants.forEach((p, index) => {
        const share = index === 0 ? firstShare : remainingShare / remainingParticipants;
        result.push({
          expenseId: '', // Will be set when expense is created
          participantId: p.id,
          share,
          amount: totalAmount * share,
          settled: false,
        });
      });
    } else {
      // Proportional split based on income ratios
      const totalRatio = participants.reduce((sum, p) => sum + p.incomeRatio, 0);
      
      participants.forEach(p => {
        const share = totalRatio > 0 ? p.incomeRatio / totalRatio : 1 / participants.length;
        result.push({
          expenseId: '', // Will be set when expense is created
          participantId: p.id,
          share,
          amount: totalAmount * share,
          settled: false,
        });
      });
    }
    
    return result;
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'household_id'>) => {
    if (!household || !user) throw new Error('No household or user');
    
    // Create expense
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        ...expense,
        household_id: household.id,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (expenseError) throw expenseError;
    
    // Calculate and create splits
    const splitsToCreate = calculateSplits(
      expense.totalAmount,
      expense.splitMethod,
      expense.fixedSplit
    ).map(s => ({
      ...s,
      expenseId: expenseData.id,
    }));
    
    if (splitsToCreate.length > 0) {
      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToCreate);
      
      if (splitsError) throw splitsError;
    }
    
    await fetchExpenses();
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    const { error: updateError } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id);
    
    if (updateError) throw updateError;
    
    // If amount or split method changed, recalculate splits
    if (updates.totalAmount !== undefined || updates.splitMethod !== undefined || updates.fixedSplit !== undefined) {
      const expense = expenses.find(e => e.id === id);
      if (expense) {
        const newAmount = updates.totalAmount ?? expense.totalAmount;
        const newMethod = updates.splitMethod ?? expense.splitMethod;
        const newFixedSplit = updates.fixedSplit ?? expense.fixedSplit;
        
        // Delete old splits
        await supabase
          .from('expense_splits')
          .delete()
          .eq('expense_id', id);
        
        // Create new splits
        const splitsToCreate = calculateSplits(newAmount, newMethod, newFixedSplit).map(s => ({
          ...s,
          expense_id: id,
        }));
        
        if (splitsToCreate.length > 0) {
          await supabase
            .from('expense_splits')
            .insert(splitsToCreate);
        }
      }
    }
    
    await fetchExpenses();
  };

  const deleteExpense = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    await fetchExpenses();
  };

  const settleSplit = async (splitId: string) => {
    const { error: settleError } = await supabase
      .from('expense_splits')
      .update({ 
        settled: true,
        settled_at: new Date().toISOString(),
      })
      .eq('id', splitId);
    
    if (settleError) throw settleError;
    await fetchExpenses();
  };

  const getMonthlyTotal = (year: number, month: number) => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return expenses
      .filter(e => e.date.startsWith(monthStr))
      .reduce((sum, e) => sum + e.totalAmount, 0);
  };

  const getByCategory = (category: string) => {
    return expenses.filter(e => e.category === category);
  };

  const getSplitsForExpense = (expenseId: string) => {
    return splits.filter(s => s.expenseId === expenseId);
  };

  const getSplitsForParticipant = (participantId: string) => {
    return splits.filter(s => s.participantId === participantId);
  };

  return {
    expenses,
    splits,
    loading,
    error,
    addExpense,
    updateExpense,
    deleteExpense,
    settleSplit,
    getMonthlyTotal,
    getByCategory,
    getSplitsForExpense,
    getSplitsForParticipant,
    refetch: fetchExpenses,
  };
}
