import { supabase } from '../lib/supabase';
import { db, getSyncQueue, removeFromSyncQueue, clearSyncQueue } from '../db';
import type { SyncQueueEntry, IncomeCategory } from '../types';

function camelToSnakeRow(tableName: string, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[snakeMap(tableName, key)] = value;
  }
  return out;
}

function snakeMap(table: string, key: string): string {
  const m = FIELD_MAP[table];
  if (m && key in m) return m[key];
  return key;
}

const FIELD_MAP: Record<string, Record<string, string>> = {
  accounts: {
    feeType: 'fee_type', feeValue: 'fee_value',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  transactions: {
    accountId: 'account_id', assetClass: 'asset_class',
    realizedPnl: 'realized_pnl',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  income_entries: {
    participantId: 'participant_id',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  households: {
    inviteCode: 'invite_code', splitMethod: 'split_method', fixedSplit: 'fixed_split',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  participants: {
    householdId: 'household_id', userId: 'user_id', incomeRatio: 'income_ratio',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  expenses: {
    totalAmount: 'total_amount', paidBy: 'paid_by',
    splitMethod: 'split_method', fixedSplit: 'fixed_split',
    createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  },
  expense_splits: {
    expenseId: 'expense_id', participantId: 'participant_id',
    settledAt: 'settled_at',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
};

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

  const mapped = camelToSnakeRow(tableName, data as Record<string, unknown>);
  const dataWithUser = { ...mapped, user_id: user.id };

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
  await clearSyncQueue();
  
  const [accountsRes, transactionsRes, preferencesRes] = await Promise.all([
    supabase.from('accounts').select('*').is('deleted_at', null),
    supabase.from('transactions').select('*').is('deleted_at', null),
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

export async function initialSyncExtended(): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const remoteHasExtendedData = await checkRemoteHasExtendedData(user.id);

  if (!remoteHasExtendedData) {
    await uploadLocalExtendedData(user.id);
    return;
  }

  // Pull from Supabase
  await pullIncomeFromSupabase(user.id);
  await pullHouseholdAndExpenses(user.id);
}

async function checkRemoteHasExtendedData(userId: string): Promise<boolean> {
  const { data: incomeCheck } = await supabase
    .from('income_entries').select('id').eq('user_id', userId).is('deleted_at', null).limit(1);
  if ((incomeCheck ?? []).length > 0) return true;

  const { data: partCheck } = await supabase
    .from('participants').select('id').eq('user_id', userId).limit(1);
  if ((partCheck ?? []).length > 0) return true;

  return false;
}

async function uploadLocalExtendedData(userId: string): Promise<void> {
  const localIncome = await db.incomeEntries.filter((e) => e.deletedAt === undefined).toArray();
  const localHh = await db.households.toArray();
  const localParts = await db.participants.filter((p) => p.deletedAt === undefined).toArray();
  const localExp = await db.expenses.filter((e) => e.deletedAt === undefined).toArray();
  const localSplits = await db.expenseSplits.toArray();

  if (localIncome.length > 0) {
    for (const e of localIncome) {
      await supabase.from('income_entries').insert({
        user_id: userId, id: e.id, date: e.date, source: e.source,
        category: e.category, amount: e.amount, currency: e.currency,
        participant_id: e.participantId ?? null, notes: e.notes ?? null,
        created_at: e.createdAt, updated_at: e.updatedAt, deleted_at: e.deletedAt ?? null,
      });
    }
  }

  if (localHh.length > 0) {
    for (const h of localHh) {
      await supabase.from('households').insert({
        id: h.id, name: h.name, invite_code: h.inviteCode,
        split_method: h.splitMethod, fixed_split: h.fixedSplit ?? null,
        created_at: h.createdAt, updated_at: h.updatedAt,
      });
    }
  }

  if (localParts.length > 0) {
    for (const p of localParts) {
      await supabase.from('participants').insert({
        id: p.id, user_id: p.userId ?? null, household_id: p.householdId,
        name: p.name, income_ratio: p.incomeRatio,
        created_at: p.createdAt, updated_at: p.updatedAt, deleted_at: p.deletedAt ?? null,
      });
    }
  }

  if (localExp.length > 0) {
    for (const e of localExp) {
      await supabase.from('expenses').insert({
        id: e.id, household_id: e.householdId ?? null, date: e.date,
        description: e.description, category: e.category, total_amount: e.totalAmount,
        currency: e.currency, paid_by: e.paidBy, split_method: e.splitMethod,
        fixed_split: e.fixedSplit ?? null,
        created_at: e.createdAt, updated_at: e.updatedAt, deleted_at: e.deletedAt ?? null,
      });
    }
  }

  if (localSplits.length > 0) {
    for (const s of localSplits) {
      await supabase.from('expense_splits').insert({
        id: s.id, expense_id: s.expenseId, participant_id: s.participantId,
        share: s.share, amount: s.amount, settled: s.settled,
        settled_at: s.settledAt ?? null,
        created_at: s.createdAt, updated_at: s.updatedAt,
      });
    }
  }
}

async function pullIncomeFromSupabase(userId: string): Promise<void> {
  const { data: incomeData } = await supabase.from('income_entries')
    .select('*').eq('user_id', userId).is('deleted_at', null);
  if (incomeData) {
    for (const e of incomeData) {
      await db.incomeEntries.put({
        id: e.id, date: e.date, source: e.source, category: e.category as IncomeCategory,
        amount: e.amount, currency: e.currency, participantId: e.participant_id ?? undefined,
        notes: e.notes ?? undefined, createdAt: e.created_at, updatedAt: e.updated_at,
        deletedAt: e.deleted_at ?? undefined,
      });
    }
  }
}

async function pullHouseholdAndExpenses(userId: string): Promise<void> {
  const { data: partData } = await supabase.from('participants')
    .select('*').eq('user_id', userId).is('deleted_at', null).single();
  if (!partData) return;

  const { data: hhData } = await supabase.from('households')
    .select('*').eq('id', partData.household_id).single();
  if (hhData) {
    await db.households.put({
      id: hhData.id, name: hhData.name, inviteCode: hhData.invite_code,
      splitMethod: hhData.split_method, fixedSplit: hhData.fixed_split ?? undefined,
      createdAt: hhData.created_at, updatedAt: hhData.updated_at,
    });
  }

  const { data: allParts } = await supabase.from('participants')
    .select('*').eq('household_id', partData.household_id).is('deleted_at', null);
  if (allParts) {
    for (const p of allParts) {
      await db.participants.put({
        id: p.id, name: p.name, householdId: p.household_id,
        userId: p.user_id ?? undefined, incomeRatio: p.income_ratio ?? 0,
        createdAt: p.created_at, updatedAt: p.updated_at,
        deletedAt: p.deleted_at ?? undefined,
      });
    }
  }

  const { data: expData } = await supabase.from('expenses')
    .select('*').eq('household_id', partData.household_id).is('deleted_at', null);
  if (expData) {
    await db.expenses.clear();
    for (const e of expData) {
      await db.expenses.put({
        id: e.id, date: e.date, description: e.description, category: e.category,
        totalAmount: e.total_amount, currency: e.currency, paidBy: e.paid_by,
        splitMethod: e.split_method, fixedSplit: e.fixed_split ?? undefined,
        createdAt: e.created_at, updatedAt: e.updated_at,
        deletedAt: e.deleted_at ?? undefined,
      });
    }

    const ids = expData.map((e) => e.id);
    const { data: splitData } = ids.length > 0
      ? await supabase.from('expense_splits').select('*').in('expense_id', ids)
      : { data: [] };
    await db.expenseSplits.clear();
    if (splitData) {
      for (const s of splitData) {
        await db.expenseSplits.put({
          id: s.id, expenseId: s.expense_id, participantId: s.participant_id,
          share: s.share, amount: s.amount, settled: s.settled,
          settledAt: s.settled_at ?? undefined,
          createdAt: s.created_at, updatedAt: s.updated_at,
        });
      }
    }
  }
}

export function subscribeToChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'preferences' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'households' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
