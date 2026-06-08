import { addToSyncQueue } from '../db';
import type { Account, Transaction, Preference, IncomeEntry, Household, Participant, Expense, ExpenseSplit } from '../types';

export async function enqueueAccountChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  account: Account
): Promise<void> {
  await addToSyncQueue({
    tableName: 'accounts',
    operation,
    data: account as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueTransactionChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  transaction: Transaction
): Promise<void> {
  await addToSyncQueue({
    tableName: 'transactions',
    operation,
    data: transaction as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueuePreferenceChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  preference: Preference
): Promise<void> {
  await addToSyncQueue({
    tableName: 'preferences',
    operation,
    data: preference as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueIncomeChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  entry: IncomeEntry
): Promise<void> {
  await addToSyncQueue({
    tableName: 'income_entries',
    operation,
    data: entry as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueExpenseChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  expense: Expense
): Promise<void> {
  await addToSyncQueue({
    tableName: 'expenses',
    operation,
    data: expense as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueExpenseSplitChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  split: ExpenseSplit
): Promise<void> {
  await addToSyncQueue({
    tableName: 'expense_splits',
    operation,
    data: split as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueHouseholdChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  household: Household
): Promise<void> {
  await addToSyncQueue({
    tableName: 'households',
    operation,
    data: household as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function enqueueParticipantChange(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  participant: Participant
): Promise<void> {
  await addToSyncQueue({
    tableName: 'participants',
    operation,
    data: participant as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}
