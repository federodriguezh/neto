import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Household, Participant } from '../types';

export function useHouseholds() {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHousehold = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    // Find participant for this user
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();
    
    if (participantError || !participantData) {
      setHousehold(null);
      setParticipants([]);
      setLoading(false);
      return;
    }
    
    // Fetch household
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .select('*')
      .eq('id', participantData.household_id)
      .single();
    
    if (householdError) {
      setError(householdError.message);
      setLoading(false);
      return;
    }
    
    setHousehold(householdData);
    
    // Fetch all participants
    const { data: allParticipants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('household_id', householdData.id)
      .is('deleted_at', null);
    
    if (participantsError) {
      setError(participantsError.message);
    } else {
      setParticipants(allParticipants || []);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const createHousehold = async (name: string, participantName: string) => {
    if (!user) throw new Error('No user');
    
    // Create household
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .insert({ name })
      .select()
      .single();
    
    if (householdError) throw householdError;
    
    // Create first participant
    const { error: participantError } = await supabase
      .from('participants')
      .insert({
        household_id: householdData.id,
        user_id: user.id,
        name: participantName,
        income_ratio: 0.5,
      });
    
    if (participantError) throw participantError;
    
    await fetchHousehold();
  };

  const joinHousehold = async (inviteCode: string, participantName: string) => {
    if (!user) throw new Error('No user');
    
    // Find household by invite code
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();
    
    if (householdError) throw new Error('Invalid invite code');
    
    // Check if user is already a participant
    const { data: existingParticipant } = await supabase
      .from('participants')
      .select('id')
      .eq('household_id', householdData.id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();
    
    if (existingParticipant) {
      throw new Error('You are already a member of this household');
    }
    
    // Add participant
    const { error: participantError } = await supabase
      .from('participants')
      .insert({
        household_id: householdData.id,
        user_id: user.id,
        name: participantName,
        income_ratio: 0.5,
      });
    
    if (participantError) throw participantError;
    
    await fetchHousehold();
  };

  const updateHousehold = async (updates: Partial<Household>) => {
    if (!household) throw new Error('No household');
    
    const { error: updateError } = await supabase
      .from('households')
      .update(updates)
      .eq('id', household.id);
    
    if (updateError) throw updateError;
    await fetchHousehold();
  };

  const addParticipant = async (name: string) => {
    if (!household) throw new Error('No household');
    
    const { error: insertError } = await supabase
      .from('participants')
      .insert({
        household_id: household.id,
        name,
        income_ratio: 0,
      });
    
    if (insertError) throw insertError;
    await fetchHousehold();
  };

  const updateParticipant = async (id: string, updates: Partial<Participant>) => {
    const { error: updateError } = await supabase
      .from('participants')
      .update(updates)
      .eq('id', id);
    
    if (updateError) throw updateError;
    await fetchHousehold();
  };

  const removeParticipant = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('participants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    await fetchHousehold();
  };

  const recalculateIncomeRatios = async () => {
    if (!household || !user) return;
    
    // Get all participants
    const { data: allParticipants } = await supabase
      .from('participants')
      .select('id')
      .eq('household_id', household.id)
      .is('deleted_at', null);
    
    if (!allParticipants || allParticipants.length === 0) return;
    
    // Calculate total income for each participant
    const incomes: Record<string, number> = {};
    let totalIncome = 0;
    
    for (const p of allParticipants) {
      const { data: incomeData } = await supabase
        .from('income_entries')
        .select('amount')
        .eq('participant_id', p.id)
        .is('deleted_at', null);
      
      const participantIncome = (incomeData || []).reduce((sum, e) => sum + e.amount, 0);
      incomes[p.id] = participantIncome;
      totalIncome += participantIncome;
    }
    
    // Update ratios
    for (const p of allParticipants) {
      const ratio = totalIncome > 0 ? incomes[p.id] / totalIncome : 1 / allParticipants.length;
      await supabase
        .from('participants')
        .update({ income_ratio: ratio })
        .eq('id', p.id);
    }
    
    await fetchHousehold();
  };

  return {
    household,
    participants,
    loading,
    error,
    createHousehold,
    joinHousehold,
    updateHousehold,
    addParticipant,
    updateParticipant,
    removeParticipant,
    recalculateIncomeRatios,
    refetch: fetchHousehold,
  };
}
