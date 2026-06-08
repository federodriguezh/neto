import { supabase } from '../lib/supabase';
import { db, getSyncQueue, removeFromSyncQueue, clearSyncQueue } from '../db';
import type { SyncQueueEntry } from '../types';

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await processQueueEntry(entry);
      await removeFromSyncQueue(entry.id);
      success++;
    } catch (err) {
      console.error(`[sync] Failed to process queue entry ${entry.id}:`, err);
      failed++;
    }
  }

  return { success, failed };
}

async function processQueueEntry(entry: SyncQueueEntry): Promise<void> {
  const { tableName, operation, data } = entry;
  const recordId = data.id as string;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  const dataWithUser = { ...data, user_id: user.id };

  switch (operation) {
    case 'INSERT':
      await supabase.from(tableName).insert(dataWithUser);
      break;

    case 'UPDATE':
      await supabase.from(tableName).update(dataWithUser).eq('id', recordId);
      break;

    case 'DELETE':
      await supabase.from(tableName).delete().eq('id', recordId);
      break;
  }
}

export async function initialSync(): Promise<void> {
  const [accountsRes, transactionsRes, preferencesRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('deleted_at', null),
    supabase.from('transactions').select('*').eq('deleted_at', null),
    supabase.from('preferences').select('*'),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (preferencesRes.error) throw preferencesRes.error;

  const remoteHasData = accountsRes.data.length > 0 || transactionsRes.data.length > 0;

  if (!remoteHasData) {
    const localAccounts = await db.accounts.filter((a) => a.deletedAt === undefined).toArray();
    const localTxns = await db.transactions.filter((t) => t.deletedAt === undefined).toArray();
    const localPrefs = await db.preferences.toArray();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (localAccounts.length > 0) {
      await supabase.from('accounts').insert(
        localAccounts.map((a) => ({
          user_id: user.id, id: a.id, name: a.name,
          fee_type: a.feeType, fee_value: a.feeValue,
          created_at: a.createdAt, updated_at: a.updatedAt,
          deleted_at: a.deletedAt ?? null,
        }))
      );
    }
    if (localTxns.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < localTxns.length; i += chunkSize) {
        await supabase.from('transactions').insert(
          localTxns.slice(i, i + chunkSize).map((t) => ({
            user_id: user.id, id: t.id, account_id: t.accountId, date: t.date,
            symbol: t.symbol, asset_class: t.assetClass, type: t.type,
            quantity: t.quantity, price: t.price, fees: t.fees,
            currency: t.currency, realized_pnl: t.realizedPnl ?? null,
            created_at: t.createdAt, updated_at: t.updatedAt,
            deleted_at: t.deletedAt ?? null,
          }))
        );
      }
    }
    if (localPrefs.length > 0) {
      await supabase.from('preferences').insert(
        localPrefs.map((p) => ({ user_id: user.id, key: p.key, value: p.value }))
      );
    }

    await clearSyncQueue();
    return;
  }

  await db.transaction('rw', [db.accounts, db.transactions, db.preferences], async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.preferences.clear();

    if (accountsRes.data.length > 0) {
      await db.accounts.bulkPut(
        accountsRes.data.map((a) => ({
          id: a.id,
          name: a.name,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          deletedAt: a.deleted_at ?? undefined,
          feeType: a.fee_type,
          feeValue: a.fee_value,
        }))
      );
    }

    if (transactionsRes.data.length > 0) {
      await db.transactions.bulkPut(
        transactionsRes.data.map((t) => ({
          id: t.id,
          date: t.date,
          accountId: t.account_id,
          symbol: t.symbol,
          assetClass: t.asset_class as 'arg_stocks' | 'arg_cedears' | 'arg_bonds',
          type: t.type as 'buy' | 'sell',
          quantity: t.quantity,
          price: t.price,
          fees: t.fees,
          currency: t.currency,
          realizedPnl: t.realized_pnl ?? undefined,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          deletedAt: t.deleted_at ?? undefined,
        }))
      );
    }

    if (preferencesRes.data.length > 0) {
      await db.preferences.bulkPut(
        preferencesRes.data.map((p) => ({
          key: p.key,
          value: p.value,
        }))
      );
    }
  });

  await clearSyncQueue();
}

export function subscribeToChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'accounts' },
      () => onChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      () => onChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'preferences' },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
