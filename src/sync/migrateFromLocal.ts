import { supabase } from '../lib/supabase';
import { db } from '../db';

export async function migrateLocalDataToSupabase(userId: string): Promise<{
  accounts: number;
  transactions: number;
  preferences: number;
}> {
  const [accounts, transactions, preferences] = await Promise.all([
    db.accounts.filter((a) => a.deletedAt === undefined).toArray(),
    db.transactions.filter((t) => t.deletedAt === undefined).toArray(),
    db.preferences.toArray(),
  ]);

  let accountsCount = 0;
  let transactionsCount = 0;
  let preferencesCount = 0;

  if (accounts.length > 0) {
    const { error } = await supabase.from('accounts').insert(
      accounts.map((a) => ({
        id: a.id,
        user_id: userId,
        name: a.name,
        fee_type: a.feeType,
        fee_value: a.feeValue,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
        deleted_at: a.deletedAt ?? null,
      }))
    );
    if (error) throw error;
    accountsCount = accounts.length;
  }

  if (transactions.length > 0) {
    const { error } = await supabase.from('transactions').insert(
      transactions.map((t) => ({
        id: t.id,
        user_id: userId,
        account_id: t.accountId,
        date: t.date,
        symbol: t.symbol,
        asset_class: t.assetClass,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        fees: t.fees,
        currency: t.currency,
        realized_pnl: t.realizedPnl ?? null,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        deleted_at: t.deletedAt ?? null,
      }))
    );
    if (error) throw error;
    transactionsCount = transactions.length;
  }

  if (preferences.length > 0) {
    const { error } = await supabase.from('preferences').insert(
      preferences.map((p) => ({
        user_id: userId,
        key: p.key,
        value: p.value,
      }))
    );
    if (error) throw error;
    preferencesCount = preferences.length;
  }

  await db.transaction('rw', [db.accounts, db.transactions, db.preferences], async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.preferences.clear();
  });

  return {
    accounts: accountsCount,
    transactions: transactionsCount,
    preferences: preferencesCount,
  };
}

export async function hasLocalData(): Promise<boolean> {
  const [accountCount, transactionCount] = await Promise.all([
    db.accounts.count(),
    db.transactions.count(),
  ]);
  return accountCount > 0 || transactionCount > 0;
}
