import { addToSyncQueue } from '../db';
import type { Account, Transaction, Preference } from '../types';

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
