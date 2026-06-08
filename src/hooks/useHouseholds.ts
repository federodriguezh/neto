import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getLocalHousehold, addLocalHousehold, updateLocalHousehold,
  getLocalParticipants, addLocalParticipant, updateLocalParticipant, deleteLocalParticipant,
  setPreference, getPreference,
} from '../db';
import { enqueueHouseholdChange, enqueueParticipantChange } from '../sync/offlineQueue';
import type { Household, Participant } from '../types';

export function useHouseholds() {
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const activeHousehold = households.find((h) => h.id === activeHouseholdId) ?? households[0] ?? null;

  const loadLocal = useCallback(async () => {
    const all = await getLocalHousehold();
    const hhs = all ?? [];
    setHouseholds(hhs);
    if (hhs.length > 0) {
      const pref = await getPreference('activeHouseholdId');
      const activeId = (pref?.value as string) ?? hhs[0].id;
      setActiveHouseholdId(activeId);
      const parts = await getLocalParticipants();
      setParticipants(parts);
    }
    setLoading(false);
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    if (!user) return;
    try {
      const { data: partRows } = await supabase
        .rpc('get_participants_by_user', { p_user_id: user.id });
      
      const typedParts = (partRows as unknown as Array<{ household_id: string; deleted_at: string | null }>) || [];
      if (!typedParts.length) return;
      const householdIds = [...new Set(typedParts
        .filter((p) => p.deleted_at === null)
        .map((p) => p.household_id))];
      const { data: hhRows } = await supabase
        .from('households')
        .select('*')
        .in('id', householdIds);
      if (!hhRows?.length) return;

      const mappedHhs: Household[] = hhRows.map((h) => ({
        ...h,
        inviteCode: h.invite_code,
        splitMethod: h.split_method,
        fixedSplit: h.fixed_split ?? undefined,
        createdAt: h.created_at,
        updatedAt: h.updated_at,
      }));
      setHouseholds(mappedHhs);

      const pref = await getPreference('activeHouseholdId');
      const existingActiveId = (pref?.value as string) ?? mappedHhs[0].id;
      let activeId = mappedHhs.find((h) => h.id === existingActiveId)?.id ?? mappedHhs[0].id;
      setActiveHouseholdId(activeId);

      const { data: allParts } = await supabase
        .rpc('get_participants_by_household', { p_household_id: activeId });
      const typedAllParts = (allParts as unknown as Array<{
        id: string; user_id: string | null; household_id: string; name: string;
        income_ratio: number; created_at: string; updated_at: string; deleted_at: string | null;
      }>) || [];
      setParticipants(
        typedAllParts.map((p) => ({
          ...p,
          householdId: p.household_id,
          userId: p.user_id ?? undefined,
          incomeRatio: p.income_ratio ?? 0,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          deletedAt: p.deleted_at ?? undefined,
        }))
      );
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

  const activateHousehold = async (id: string) => {
    setActiveHouseholdId(id);
    await setPreference('activeHouseholdId', id);
    const hh = households.find((h) => h.id === id);
    if (hh) {
      try {
        const { data: allParts } = await supabase
          .rpc('get_participants_by_household', { p_household_id: id });
        const typedAllParts = (allParts as unknown as Array<{
          id: string; user_id: string | null; household_id: string; name: string;
          income_ratio: number; created_at: string; updated_at: string; deleted_at: string | null;
        }>) || [];
        setParticipants(
          typedAllParts.map((p) => ({
            ...p,
            householdId: p.household_id,
            userId: p.user_id ?? undefined,
            incomeRatio: p.income_ratio ?? 0,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            deletedAt: p.deleted_at ?? undefined,
          }))
        );
      } catch {
        const localParts = await getLocalParticipants();
        setParticipants(localParts.filter((p) => p.householdId === id));
      }
    }
  };

  const createHousehold = async (name: string, participantName: string) => {
    if (!user) throw new Error('No user');
    const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const hh = await addLocalHousehold({ name, inviteCode, splitMethod: 'proportional' });
    const part = await addLocalParticipant({ name: participantName, householdId: hh.id, userId: user.id, incomeRatio: 0.5 });

    setHouseholds((prev) => [...prev, hh]);
    setActiveHouseholdId(hh.id);
    setParticipants([part]);
    await setPreference('activeHouseholdId', hh.id);
    enqueueHouseholdChange('INSERT', hh).catch(() => {});
    enqueueParticipantChange('INSERT', part).catch(() => {});
  };

  const joinHousehold = async (inviteCode: string, participantName: string) => {
    if (!user) throw new Error('No user');
    const { data: hhData, error: hhError } = await supabase
      .from('households').select('*').eq('invite_code', inviteCode).single();
    if (hhError || !hhData) throw new Error('Invalid invite code');

    const { data: existing } = await supabase
      .from('participants').select('id, deleted_at')
      .eq('household_id', hhData.id).eq('user_id', user.id).single();
    if (existing && !existing.deleted_at) throw new Error('Already a member');

    const mappedHh: Household = {
      ...hhData,
      inviteCode: hhData.invite_code,
      splitMethod: hhData.split_method,
      fixedSplit: hhData.fixed_split ?? undefined,
      createdAt: hhData.created_at,
      updatedAt: hhData.updated_at,
    };
    await addLocalHousehold(mappedHh);
    const part = await addLocalParticipant({ name: participantName, householdId: hhData.id, userId: user.id, incomeRatio: 0.5 });
    enqueueParticipantChange('INSERT', part).catch(() => {});
    setHouseholds((prev) => [...prev.filter((h) => h.id !== hhData.id), mappedHh]);
    setActiveHouseholdId(hhData.id);
    setParticipants([part]);
    await setPreference('activeHouseholdId', hhData.id);
  };

  const updateHousehold = async (updates: Partial<Household>) => {
    if (!activeHousehold) return;
    await updateLocalHousehold(activeHousehold.id, updates);
    setHouseholds((prev) => prev.map((h) => h.id === activeHousehold.id ? { ...h, ...updates } : h));
    enqueueHouseholdChange('UPDATE', { ...activeHousehold, ...updates }).catch(() => {});
  };

  const addParticipant = async (name: string) => {
    if (!activeHousehold) return;
    const part = await addLocalParticipant({ name, householdId: activeHousehold.id, incomeRatio: 0, userId: user?.id });
    setParticipants((prev) => [...prev, part]);
    enqueueParticipantChange('INSERT', part).catch(() => {});
  };

  const updateParticipant = async (id: string, updates: Partial<Participant>) => {
    await updateLocalParticipant(id, updates);
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    const current = participants.find((p) => p.id === id);
    if (current) enqueueParticipantChange('UPDATE', { ...current, ...updates }).catch(() => {});
  };

  const removeParticipant = async (id: string) => {
    await deleteLocalParticipant(id);
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    const current = participants.find((p) => p.id === id);
    if (current) enqueueParticipantChange('DELETE', current).catch(() => {});
  };

  const recalculateIncomeRatios = async () => {
    if (!activeHousehold || !user) return;
    try {
      const { data: allParts } = await supabase.from('participants')
        .select('id').eq('household_id', activeHousehold.id);
      if (!allParts?.length) return;
      const incomes: Record<string, number> = {};
      let total = 0;
      for (const p of allParts) {
        const { data: incomeData } = await supabase.from('income_entries')
          .select('amount').eq('participant_id', p.id);
        const sum = (incomeData || []).filter((e: Record<string, unknown>) => !e.deleted_at).reduce((s: number, e: { amount: number }) => s + e.amount, 0);
        incomes[p.id] = sum;
        total += sum;
      }
      for (const p of allParts) {
        const ratio = total > 0 ? incomes[p.id] / total : 1 / allParts.length;
        await updateLocalParticipant(p.id, { incomeRatio: ratio });
        setParticipants((prev) => prev.map((pr) => (pr.id === p.id ? { ...pr, incomeRatio: ratio } : pr)));
        enqueueParticipantChange('UPDATE', { ...participants.find((pr) => pr.id === p.id)!, incomeRatio: ratio }).catch(() => {});
      }
    } catch {}
  };

  return {
    households,
    household: activeHousehold,
    activeHouseholdId,
    participants,
    loading,
    error: null,
    activateHousehold,
    createHousehold,
    joinHousehold,
    updateHousehold,
    addParticipant,
    updateParticipant,
    removeParticipant,
    recalculateIncomeRatios,
    refetch: loadLocal,
  };
}
