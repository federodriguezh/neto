import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Account,
  Transaction,
  HistoricalPrice,
  PortfolioHistory,
  PriceCacheEntry,
  Preference,
  ExchangeRate,
  SyncQueueEntry,
  IncomeEntry,
  Household,
  Participant,
  Expense,
  ExpenseSplit,
} from './schema';
import { normalizeDate } from '../utils/date';
import { enqueueAccountChange, enqueueTransactionChange, enqueuePreferenceChange } from '../sync/offlineQueue';

const DB_NAME = 'neto-db';

interface NetoDatabase extends Dexie {
  accounts: EntityTable<Account, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  historicalPrices: Table<HistoricalPrice, [string, string]>;
  portfolioHistory: Table<PortfolioHistory, string>;
  priceCache: Table<PriceCacheEntry, string>;
  preferences: Table<Preference, string>;
  exchangeRates: Table<ExchangeRate, [string, string]>;
  syncQueue: Table<SyncQueueEntry, string>;
  incomeEntries: EntityTable<IncomeEntry, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  expenseSplits: EntityTable<ExpenseSplit, 'id'>;
  households: EntityTable<Household, 'id'>;
  participants: EntityTable<Participant, 'id'>;
}

const db = new Dexie(DB_NAME) as NetoDatabase;

db.version(1).stores({
  accounts: '++id, name, createdAt',
  transactions: '++id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
});

db.version(2).stores({
  accounts: '++id, name, createdAt',
  transactions: '++id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
}).upgrade((tx) => {
  return tx.table('accounts').toCollection().modify((account: Account) => {
    account.feeType = 'fixed';
    account.feeValue = 0;
  });
});

db.version(3).stores({
  accounts: '++id, name, createdAt',
  transactions: '++id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
  preferences: 'key',
  exchangeRates: '[type+date], type, date',
});

db.version(4).stores({
  accounts: 'id, name, createdAt',
  transactions: 'id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
  preferences: 'key',
  exchangeRates: '[type+date], type, date',
}).upgrade(async (tx) => {
  const oldAccounts = await tx.table('accounts').toArray();
  const oldTransactions = await tx.table('transactions').toArray();

  localStorage.setItem(
    'neto-pre-v4-backup',
    JSON.stringify({
      accounts: oldAccounts,
      transactions: oldTransactions,
      exportedAt: new Date().toISOString(),
    })
  );

  const idMap = new Map<unknown, string>();
  const newAccounts = oldAccounts.map((a: Record<string, unknown>) => {
    const newId = crypto.randomUUID();
    idMap.set(a.id, newId);
    return {
      ...a,
      id: newId,
      updatedAt: a.createdAt,
    };
  });

  const newTransactions = oldTransactions.map((t: Record<string, unknown>) => {
    const newId = crypto.randomUUID();
    const newAccountId = idMap.get(t.accountId);
    if (!newAccountId) throw new Error(`Missing account mapping for transaction ${String(t.id)}`);
    return {
      ...t,
      id: newId,
      accountId: newAccountId,
      updatedAt: t.date,
      createdAt: t.date,
    };
  });

  await tx.table('accounts').clear();
  await tx.table('accounts').bulkPut(newAccounts);
  await tx.table('transactions').clear();
  await tx.table('transactions').bulkPut(newTransactions);
});

db.version(5).stores({
  accounts: 'id, name, createdAt',
  transactions: 'id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
  preferences: 'key',
  exchangeRates: '[type+date], type, date',
  syncQueue: 'id, tableName, timestamp',
});

db.version(6).stores({
  accounts: 'id, name, createdAt',
  transactions: 'id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
  preferences: 'key',
  exchangeRates: '[type+date], type, date',
  syncQueue: 'id, tableName, timestamp',
  incomeEntries: 'id, date, category, participantId',
  expenses: 'id, date, category, paidBy, householdId',
  expenseSplits: 'id, expenseId, participantId, settled',
  households: 'id, name, inviteCode',
  participants: 'id, name, householdId',
});

db.version(7).stores({
  accounts: 'id, name, createdAt',
  transactions: 'id, date, accountId, symbol, assetClass, type',
  historicalPrices: '[symbol+date], symbol, date, close',
  portfolioHistory: 'date, value',
  priceCache: 'symbol, price, timestamp',
  preferences: 'key',
  exchangeRates: '[type+date], type, date',
  syncQueue: 'id, tableName, timestamp',
  incomeEntries: 'id, date, category, participantId',
  expenses: 'id, date, category, paidBy, householdId',
  expenseSplits: 'id, expenseId, participantId, settled',
  households: 'id, name, inviteCode',
  participants: 'id, name, householdId',
});

export { db };

export async function getAccounts(): Promise<Account[]> {
  return db.accounts.filter((account) => account.deletedAt === undefined).toArray();
}

export async function addAccount(account: Omit<Account, 'id' | 'updatedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const createdAt = normalizeDate(account.createdAt) || account.createdAt;
  const full: Account = { ...account, id, updatedAt: now, createdAt };
  await db.accounts.add(full);
  enqueueAccountChange('INSERT', full).catch((e) => console.warn('[sync] Failed to enqueue account add:', e));
  return id;
}

export async function updateAccount(id: string, changes: Partial<Account>): Promise<void> {
  const payload: Partial<Account> = { ...changes, updatedAt: new Date().toISOString() };
  if (changes.createdAt) {
    payload.createdAt = normalizeDate(changes.createdAt) || changes.createdAt;
  }
  await db.accounts.update(id, payload);
  const updated = await db.accounts.get(id);
  if (updated) enqueueAccountChange('UPDATE', updated).catch((e) => console.warn('[sync] Failed to enqueue account update:', e));
}

export async function deleteAccount(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.accounts.update(id, { deletedAt: now, updatedAt: now });
  const deleted = await db.accounts.get(id);
  if (deleted) enqueueAccountChange('DELETE', deleted).catch((e) => console.warn('[sync] Failed to enqueue account delete:', e));
}

export async function getTransactions(): Promise<Transaction[]> {
  return db.transactions.orderBy('date').reverse().filter((tx) => tx.deletedAt === undefined).toArray();
}

export async function getTransactionsUpToDate(date: string): Promise<Transaction[]> {
  return db.transactions.where('date').belowOrEqual(date).filter((tx) => tx.deletedAt === undefined).toArray();
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'updatedAt' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const date = normalizeDate(transaction.date) || transaction.date;
  const full: Transaction = { ...transaction, id, updatedAt: now, createdAt: now, date };
  await db.transactions.add(full);
  enqueueTransactionChange('INSERT', full).catch((e) => console.warn('[sync] Failed to enqueue transaction add:', e));
  return id;
}

export async function updateTransaction(id: string, changes: Partial<Transaction>): Promise<void> {
  const payload: Partial<Transaction> = { ...changes, updatedAt: new Date().toISOString() };
  if (changes.date) {
    payload.date = normalizeDate(changes.date) || changes.date;
  }
  await db.transactions.update(id, payload);
  const updated = await db.transactions.get(id);
  if (updated) enqueueTransactionChange('UPDATE', updated).catch((e) => console.warn('[sync] Failed to enqueue transaction update:', e));
}

export async function deleteTransaction(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transactions.update(id, { deletedAt: now, updatedAt: now });
  const deleted = await db.transactions.get(id);
  if (deleted) enqueueTransactionChange('DELETE', deleted).catch((e) => console.warn('[sync] Failed to enqueue transaction delete:', e));
}

export async function getHistoricalPrice(symbol: string, date: string): Promise<HistoricalPrice | undefined> {
  return db.historicalPrices.get([symbol, date]);
}

export async function getHistoricalPricesForSymbol(symbol: string): Promise<HistoricalPrice[]> {
  return db.historicalPrices.where('symbol').equals(symbol).sortBy('date');
}

export async function putHistoricalPrices(prices: HistoricalPrice[]): Promise<void> {
  await db.historicalPrices.bulkPut(prices);
}

export async function getPortfolioHistory(): Promise<PortfolioHistory[]> {
  return db.portfolioHistory.orderBy('date').toArray();
}

export async function putPortfolioHistory(entries: PortfolioHistory[]): Promise<void> {
  await db.portfolioHistory.bulkPut(entries);
}

export async function clearPortfolioHistory(): Promise<void> {
  await db.portfolioHistory.clear();
}

export async function getPriceCache(symbol: string): Promise<PriceCacheEntry | undefined> {
  return db.priceCache.get(symbol);
}

export async function putPriceCache(entry: PriceCacheEntry): Promise<void> {
  await db.priceCache.put(entry);
}

export async function getAllPriceCache(): Promise<PriceCacheEntry[]> {
  return db.priceCache.toArray();
}

export async function clearPriceCache(): Promise<void> {
  await db.priceCache.clear();
}

export async function getPreference(key: string): Promise<Preference | undefined> {
  return db.preferences.get(key);
}

export async function setPreference(key: string, value: unknown): Promise<void> {
  await db.preferences.put({ key, value });
  enqueuePreferenceChange('INSERT', { key, value }).catch((e) => console.warn('[sync] Failed to enqueue preference:', e));
}

export async function getExchangeRate(type: 'mep' | 'ccl', date: string): Promise<ExchangeRate | undefined> {
  return db.exchangeRates.get([type, date]);
}

export async function getExchangeRatesForType(
  type: 'mep' | 'ccl',
  startDate?: string,
  endDate?: string
): Promise<ExchangeRate[]> {
  let collection = db.exchangeRates.where('type').equals(type);
  if (startDate !== undefined && endDate !== undefined) {
    collection = collection.and((er) => er.date >= startDate && er.date <= endDate);
  } else if (startDate !== undefined) {
    collection = collection.and((er) => er.date >= startDate);
  } else if (endDate !== undefined) {
    collection = collection.and((er) => er.date <= endDate);
  }
  return collection.sortBy('date');
}

export async function putExchangeRates(rates: ExchangeRate[]): Promise<void> {
  await db.exchangeRates.bulkPut(rates);
}

export async function clearExchangeRates(): Promise<void> {
  await db.exchangeRates.clear();
}

import { recalculateAllRealizedPnl } from '../utils/realizedPnlBatch';

export async function updateAllRealizedPnl(): Promise<void> {
  const allTxs = await db.transactions.filter((tx) => tx.deletedAt === undefined).toArray();
  const { pnls, diagnostics } = recalculateAllRealizedPnl(allTxs);
  for (const [id, pnl] of pnls.entries()) {
    await db.transactions.update(id, { realizedPnl: pnl });
  }
  if (diagnostics.length > 0) {
    console.warn('[updateAllRealizedPnl] Orphan/oversell detected:', diagnostics);
  }
}

export async function addToSyncQueue(entry: Omit<SyncQueueEntry, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.syncQueue.add({ ...entry, id });
  return id;
}

export async function getSyncQueue(): Promise<SyncQueueEntry[]> {
  return db.syncQueue.orderBy('timestamp').toArray();
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}

// ── Income Entries ──

export async function getLocalIncomeEntries(): Promise<IncomeEntry[]> {
  const all = await db.incomeEntries.filter((e) => e.deletedAt === undefined).toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function addLocalIncomeEntry(entry: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<IncomeEntry> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: IncomeEntry = { ...entry, id, createdAt: now, updatedAt: now };
  await db.incomeEntries.add(full);
  return full;
}

export async function updateLocalIncomeEntry(id: string, changes: Partial<IncomeEntry>): Promise<void> {
  await db.incomeEntries.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteLocalIncomeEntry(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.incomeEntries.update(id, { deletedAt: now, updatedAt: now });
}

// ── Households ──

export async function getLocalHousehold(): Promise<Household[]> {
  return db.households.toArray();
}

export async function addLocalHousehold(household: Omit<Household, 'id' | 'createdAt' | 'updatedAt'>): Promise<Household> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: Household = { ...household, id, createdAt: now, updatedAt: now };
  await db.households.add(full);
  return full;
}

export async function updateLocalHousehold(id: string, changes: Partial<Household>): Promise<void> {
  await db.households.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function clearLocalHousehold(): Promise<void> {
  await db.households.clear();
}

// ── Participants ──

export async function getLocalParticipants(): Promise<Participant[]> {
  return db.participants.filter((p) => p.deletedAt === undefined).toArray();
}

export async function addLocalParticipant(participant: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Participant> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: Participant = { ...participant, id, createdAt: now, updatedAt: now };
  await db.participants.add(full);
  return full;
}

export async function updateLocalParticipant(id: string, changes: Partial<Participant>): Promise<void> {
  await db.participants.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteLocalParticipant(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.participants.update(id, { deletedAt: now, updatedAt: now });
}

export async function clearLocalParticipants(): Promise<void> {
  await db.participants.clear();
}

// ── Expenses ──

export async function getLocalExpenses(): Promise<Expense[]> {
  const all = await db.expenses.filter((e) => e.deletedAt === undefined).toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function addLocalExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: Expense = { ...expense, id, createdAt: now, updatedAt: now };
  await db.expenses.add(full);
  return full;
}

export async function updateLocalExpense(id: string, changes: Partial<Expense>): Promise<void> {
  await db.expenses.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteLocalExpense(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.expenses.update(id, { deletedAt: now, updatedAt: now });
}

// ── Expense Splits ──

export async function getLocalExpenseSplits(): Promise<ExpenseSplit[]> {
  return db.expenseSplits.toArray();
}

export async function addLocalExpenseSplit(split: Omit<ExpenseSplit, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseSplit> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const full: ExpenseSplit = { ...split, id, createdAt: now, updatedAt: now };
  await db.expenseSplits.add(full);
  return full;
}

export async function updateLocalExpenseSplit(id: string, changes: Partial<ExpenseSplit>): Promise<void> {
  await db.expenseSplits.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteLocalExpenseSplit(id: string): Promise<void> {
  await db.expenseSplits.delete(id);
}

export async function clearLocalExpenseSplits(): Promise<void> {
  await db.expenseSplits.clear();
}
