import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getLocalIncomeEntries, addLocalIncomeEntry, updateLocalIncomeEntry, deleteLocalIncomeEntry,
} from '../db';
import { enqueueIncomeChange } from '../sync/offlineQueue';
import type { IncomeEntry, IncomeCategory } from '../types';

export function useIncome() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const local = await getLocalIncomeEntries();
    setEntries(local);
    setLoading(false);
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (data && data.length > 0) {
        setEntries(data
          .filter((e) => e.deleted_at === null)
          .map((e) => ({
          ...e,
          participantId: e.participant_id ?? undefined,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          deletedAt: e.deleted_at ?? undefined,
        })));
      }
    } catch { /* ignore network errors, local data is already shown */ }
  }, [user]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    fetchFromSupabase();
  }, [fetchFromSupabase]);

  useEffect(() => {
    const id = setInterval(() => { fetchFromSupabase().catch(() => {}); }, 60000);
    const onFocus = () => { fetchFromSupabase().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [fetchFromSupabase]);

  const addEntry = async (entry: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const full = await addLocalIncomeEntry(entry);
    setEntries((prev) => [full, ...prev]);
    if (user) enqueueIncomeChange('INSERT', full).catch(() => {});
  };

  const updateEntry = async (id: string, updates: Partial<IncomeEntry>) => {
    await updateLocalIncomeEntry(id, updates);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    const current = entries.find((e) => e.id === id);
    if (current) enqueueIncomeChange('UPDATE', { ...current, ...updates }).catch(() => {});
  };

  const deleteEntry = async (id: string) => {
    await deleteLocalIncomeEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const current = entries.find((e) => e.id === id);
    if (current) enqueueIncomeChange('DELETE', current).catch(() => {});
  };

  const getMonthlyTotal = (year: number, month: number) => {
    return entries
      .filter((e) => e.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getYearlyTotal = (year: number) => {
    return entries
      .filter((e) => e.date.startsWith(String(year)))
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getByCategory = (category: IncomeCategory) => entries.filter((e) => e.category === category);

  return {
    entries, loading, error: null, addEntry, updateEntry, deleteEntry,
    getMonthlyTotal, getYearlyTotal, getByCategory, refetch: loadLocal,
  };
}
