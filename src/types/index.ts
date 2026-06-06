export type AssetClass = 'arg_stocks' | 'arg_cedears' | 'arg_bonds';
export type TransactionType = 'buy' | 'sell';
export type DisplayCurrency = 'ARS' | 'MEP' | 'CCL';

export interface Account {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  feeType: 'fixed' | 'percentage';
  feeValue: number;
}

export interface Transaction {
  id: string;
  date: string;
  accountId: string;
  symbol: string;
  assetClass: AssetClass;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  realizedPnl?: number;
  updatedAt: string;
  createdAt: string;
  deletedAt?: string;
}

export interface HistoricalPrice {
  symbol: string;
  date: string;
  open?: number;
  close: number;
}

export interface PortfolioHistory {
  date: string;
  value: number;
}

export interface PriceCacheEntry {
  symbol: string;
  price: number;
  pctChange?: number;
  timestamp: number;
}

export interface Preference {
  key: string;
  value: unknown;
}

export interface ExchangeRate {
  type: 'mep' | 'ccl';
  date: string;
  rate: number;
}

export interface Holding {
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface SyncQueueEntry {
  id: string;
  tableName: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: string;
  retryCount: number;
}

export type IncomeCategory = 'salary' | 'freelance' | 'investment' | 'gift' | 'other';

export interface IncomeEntry {
  id: string;
  date: string;
  source: string;
  category: IncomeCategory;
  amount: number;
  currency: string;
  participantId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  splitMethod: 'proportional' | 'fixed';
  fixedSplit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  householdId: string;
  userId?: string;
  incomeRatio: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  totalAmount: number;
  currency: string;
  paidBy: string;
  splitMethod: 'proportional' | 'fixed';
  fixedSplit?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  participantId: string;
  share: number;
  amount: number;
  settled: boolean;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}
