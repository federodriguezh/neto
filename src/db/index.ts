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
} from './schema';
import { normalizeDate } from '../utils/date';

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

export { db };

export async function getAccounts(): Promise<Account[]> {
  return db.accounts.filter((account) => account.deletedAt === undefined).toArray();
}

export async function addAccount(account: Omit<Account, 'id' | 'updatedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const createdAt = normalizeDate(account.createdAt) || account.createdAt;
  await db.accounts.add({ ...account, id, updatedAt: now, createdAt });
  return id;
}

export async function updateAccount(id: string, changes: Partial<Account>): Promise<void> {
  const payload: Partial<Account> = { ...changes, updatedAt: new Date().toISOString() };
  if (changes.createdAt) {
    payload.createdAt = normalizeDate(changes.createdAt) || changes.createdAt;
  }
  await db.accounts.update(id, payload);
}

export async function deleteAccount(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.accounts.update(id, { deletedAt: now, updatedAt: now });
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
  await db.transactions.add({ ...transaction, id, updatedAt: now, createdAt: now, date });
  return id;
}

export async function updateTransaction(id: string, changes: Partial<Transaction>): Promise<void> {
  const payload: Partial<Transaction> = { ...changes, updatedAt: new Date().toISOString() };
  if (changes.date) {
    payload.date = normalizeDate(changes.date) || changes.date;
  }
  await db.transactions.update(id, payload);
}

export async function deleteTransaction(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transactions.update(id, { deletedAt: now, updatedAt: now });
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
