import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { IncomeEntry, IncomeCategory } from '../types';

export function useIncome() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('income_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('date', { ascending: false });
    
    if (fetchError) {
      setError(fetchError.message);
      setEntries([]);
    } else {
      setEntries(data || []);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (entry: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('No user');
    
    const { error: insertError } = await supabase
      .from('income_entries')
      .insert({
        ...entry,
        user_id: user.id,
      });
    
    if (insertError) throw insertError;
    await fetchEntries();
  };

  const updateEntry = async (id: string, updates: Partial<IncomeEntry>) => {
    const { error: updateError } = await supabase
      .from('income_entries')
      .update(updates)
      .eq('id', id);
    
    if (updateError) throw updateError;
    await fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('income_entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    await fetchEntries();
  };

  const getMonthlyTotal = (year: number, month: number) => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return entries
      .filter(e => e.date.startsWith(monthStr))
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getYearlyTotal = (year: number) => {
    const yearStr = String(year);
    return entries
      .filter(e => e.date.startsWith(yearStr))
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getByCategory = (category: IncomeCategory) => {
    return entries.filter(e => e.category === category);
  };

  return {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    getMonthlyTotal,
    getYearlyTotal,
    getByCategory,
    refetch: fetchEntries,
  };
}
