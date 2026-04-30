import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Account,
  Transaction,
  HistoricalPrice,
  PortfolioHistory,
  PriceCacheEntry,
} from './schema';

const DB_NAME = 'neto-db';

interface NetoDatabase extends Dexie {
  accounts: EntityTable<Account, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
  historicalPrices: Table<HistoricalPrice, [string, string]>;
  portfolioHistory: Table<PortfolioHistory, string>;
  priceCache: Table<PriceCacheEntry, string>;
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

export { db };

export async function getAccounts(): Promise<Account[]> {
  return db.accounts.toArray();
}

export async function addAccount(account: Omit<Account, 'id'>): Promise<number> {
  const id = await db.accounts.add(account as Account);
  return id as number;
}

export async function updateAccount(id: number, changes: Partial<Account>): Promise<void> {
  await db.accounts.update(id, changes);
}

export async function deleteAccount(id: number): Promise<void> {
  await db.accounts.delete(id);
}

export async function getTransactions(): Promise<Transaction[]> {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function getTransactionsUpToDate(date: string): Promise<Transaction[]> {
  return db.transactions.where('date').belowOrEqual(date).toArray();
}

export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<number> {
  const id = await db.transactions.add(transaction as Transaction);
  return id as number;
}

export async function updateTransaction(id: number, changes: Partial<Transaction>): Promise<void> {
  await db.transactions.update(id, changes);
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.transactions.delete(id);
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
