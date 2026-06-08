import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getLocalHousehold, addLocalHousehold, updateLocalHousehold,
  getLocalParticipants, addLocalParticipant, updateLocalParticipant, deleteLocalParticipant,
} from '../db';
import { enqueueHouseholdChange, enqueueParticipantChange } from '../sync/offlineQueue';
import type { Household, Participant } from '../types';

export function useHouseholds() {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const hh = await getLocalHousehold();
    const parts = await getLocalParticipants();
    if (hh) {
      setHousehold(hh);
      setParticipants(parts);
    }
    setLoading(false);
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    if (!user) return;
    try {
      const { data: partData } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();
      if (!partData) return;

      const { data: hhData } = await supabase
        .from('households')
        .select('*')
        .eq('id', partData.household_id)
        .single();
      if (!hhData) return;

      const { data: allParts } = await supabase
        .from('participants')
        .select('*')
        .eq('household_id', hhData.id)
        .is('deleted_at', null);

      setHousehold(hhData);
      setParticipants(allParts || []);
    } catch { /* ignore, local data already shown */ }
  }, [user]);

  useEffect(() => { loadLocal(); }, [loadLocal]);
  useEffect(() => { fetchFromSupabase(); }, [fetchFromSupabase]);

  useEffect(() => {
    const id = setInterval(() => { fetchFromSupabase().catch(() => {}); }, 60000);
    const onFocus = () => { fetchFromSupabase().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [fetchFromSupabase]);

  const createHousehold = async (name: string, participantName: string) => {
    if (!user) throw new Error('No user');

    const hh = await addLocalHousehold({ name, inviteCode: '', splitMethod: 'proportional' });
    const part = await addLocalParticipant({ name: participantName, householdId: hh.id, userId: user.id, incomeRatio: 0.5 });

    setHousehold(hh);
    setParticipants([part]);
    enqueueHouseholdChange('INSERT', hh).catch(() => {});
    enqueueParticipantChange('INSERT', part).catch(() => {});

    try {
      const { data: supabaseHh } = await supabase.from('households').insert({ name }).select().single();
      if (supabaseHh) {
        await updateLocalHousehold(hh.id, { id: supabaseHh.id, inviteCode: supabaseHh.invite_code });
        setHousehold((prev) => prev ? { ...prev, id: supabaseHh.id, inviteCode: supabaseHh.invite_code } : null);
      }
      await supabase.from('participants').insert({
        user_id: user.id, name: participantName,
        household_id: supabaseHh?.id ?? hh.id, income_ratio: 0.5,
      });
    } catch { /* synced later */ }
  };

  const joinHousehold = async (inviteCode: string, participantName: string) => {
    if (!user) throw new Error('No user');
    const { data: hhData, error: hhError } = await supabase
      .from('households').select('*').eq('invite_code', inviteCode).single();
    if (hhError || !hhData) throw new Error('Invalid invite code');

    const { data: existing } = await supabase
      .from('participants').select('id')
      .eq('household_id', hhData.id).eq('user_id', user.id).is('deleted_at', null).single();
    if (existing) throw new Error('Already a member');

    await supabase.from('participants').insert({ household_id: hhData.id, user_id: user.id, name: participantName, income_ratio: 0.5 });

    const localHh = await addLocalHousehold(hhData);
    const part = await addLocalParticipant({ name: participantName, householdId: hhData.id, userId: user.id, incomeRatio: 0.5 });
    setHousehold(localHh);
    setParticipants([part]);
  };

  const updateHousehold = async (updates: Partial<Household>) => {
    if (!household) return;
    await updateLocalHousehold(household.id, updates);
    setHousehold((prev) => prev ? { ...prev, ...updates } : null);
    enqueueHouseholdChange('UPDATE', { ...household, ...updates }).catch(() => {});
    try { await supabase.from('households').update(updates).eq('id', household.id); } catch {}
  };

  const addParticipant = async (name: string) => {
    if (!household) return;
    const part = await addLocalParticipant({ name, householdId: household.id, incomeRatio: 0, userId: user?.id });
    setParticipants((prev) => [...prev, part]);
    enqueueParticipantChange('INSERT', part).catch(() => {});
    try {
      await supabase.from('participants').insert({
        household_id: household.id, name, income_ratio: 0,
        user_id: user?.id ?? null,
      });
    } catch {}
  };

  const updateParticipant = async (id: string, updates: Partial<Participant>) => {
    await updateLocalParticipant(id, updates);
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    const current = participants.find((p) => p.id === id);
    if (current) enqueueParticipantChange('UPDATE', { ...current, ...updates }).catch(() => {});
    try { await supabase.from('participants').update(updates).eq('id', id); } catch {}
  };

  const removeParticipant = async (id: string) => {
    await deleteLocalParticipant(id);
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    const current = participants.find((p) => p.id === id);
    if (current) enqueueParticipantChange('DELETE', current).catch(() => {});
    try { await supabase.from('participants').update({ deleted_at: new Date().toISOString() }).eq('id', id); } catch {}
  };

  const recalculateIncomeRatios = async () => {
    if (!household || !user) return;
    try {
      const { data: allParts } = await supabase.from('participants')
        .select('id').eq('household_id', household.id).is('deleted_at', null);
      if (!allParts?.length) return;

      const incomes: Record<string, number> = {};
      let total = 0;
      for (const p of allParts) {
        const { data: incomeData } = await supabase.from('income_entries')
          .select('amount').eq('participant_id', p.id).is('deleted_at', null);
        const sum = (incomeData || []).reduce((s, e) => s + e.amount, 0);
        incomes[p.id] = sum;
        total += sum;
      }
      for (const p of allParts) {
        const ratio = total > 0 ? incomes[p.id] / total : 1 / allParts.length;
        await updateLocalParticipant(p.id, { incomeRatio: ratio });
        setParticipants((prev) => prev.map((pr) => (pr.id === p.id ? { ...pr, incomeRatio: ratio } : pr)));
        try { await supabase.from('participants').update({ income_ratio: ratio }).eq('id', p.id); } catch {}
      }
    } catch {}
  };

  return {
    household, participants, loading, error: null,
    createHousehold, joinHousehold, updateHousehold,
    addParticipant, updateParticipant, removeParticipant,
    recalculateIncomeRatios, refetch: loadLocal,
  };
}
