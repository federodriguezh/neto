import { useMemo } from 'react';
import { useExpenses } from './useExpenses';
import { useHouseholds } from './useHouseholds';

interface Balance {
  participantId: string;
  participantName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface Debt {
  fromParticipantId: string;
  fromParticipantName: string;
  toParticipantId: string;
  toParticipantName: string;
  amount: number;
}

export function useBalances() {
  const { participants } = useHouseholds();
  const { expenses, splits, loading } = useExpenses();

  const balances = useMemo(() => {
    if (participants.length === 0) return [];

    const balanceMap = new Map<string, Balance>();

    // Initialize balances for all participants
    participants.forEach(p => {
      balanceMap.set(p.id, {
        participantId: p.id,
        participantName: p.name,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      });
    });

    // Calculate total paid by each participant
    expenses.forEach(expense => {
      const balance = balanceMap.get(expense.paidBy);
      if (balance) {
        balance.totalPaid += expense.totalAmount;
      }
    });

    // Calculate total owed by each participant
    splits.forEach(split => {
      const balance = balanceMap.get(split.participantId);
      if (balance && !split.settled) {
        balance.totalOwed += split.amount;
      }
    });

    // Calculate net balance
    balanceMap.forEach(balance => {
      balance.netBalance = balance.totalPaid - balance.totalOwed;
    });

    return Array.from(balanceMap.values());
  }, [participants, expenses, splits]);

  const debts = useMemo(() => {
    if (balances.length === 0) return [];

    const debtList: Debt[] = [];
    const creditors = balances.filter(b => b.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance);
    const debtors = balances.filter(b => b.netBalance < 0).sort((a, b) => a.netBalance - b.netBalance);

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(Math.abs(debtor.netBalance), creditor.netBalance);
      
      if (amount > 0.01) { // Avoid tiny amounts due to floating point
        debtList.push({
          fromParticipantId: debtor.participantId,
          fromParticipantName: debtor.participantName,
          toParticipantId: creditor.participantId,
          toParticipantName: creditor.participantName,
          amount,
        });
      }

      // Update balances
      debtor.netBalance += amount;
      creditor.netBalance -= amount;

      // Move to next debtor/creditor if settled
      if (Math.abs(debtor.netBalance) < 0.01) i++;
      if (Math.abs(creditor.netBalance) < 0.01) j++;
    }

    return debtList;
  }, [balances]);

  const getBalanceForParticipant = (participantId: string): Balance | undefined => {
    return balances.find(b => b.participantId === participantId);
  };

  const getTotalSettled = () => {
    return splits
      .filter(s => s.settled)
      .reduce((sum, s) => sum + s.amount, 0);
  };

  const getTotalPending = () => {
    return splits
      .filter(s => !s.settled)
      .reduce((sum, s) => sum + s.amount, 0);
  };

  const isBalanced = () => {
    return balances.every(b => Math.abs(b.netBalance) < 0.01);
  };

  return {
    balances,
    debts,
    loading,
    getBalanceForParticipant,
    getTotalSettled,
    getTotalPending,
    isBalanced,
  };
}
