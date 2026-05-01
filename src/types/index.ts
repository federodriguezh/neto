export type AssetClass = 'arg_stocks' | 'arg_cedears' | 'arg_bonds';
export type TransactionType = 'buy' | 'sell';
export type DisplayCurrency = 'ARS' | 'MEP' | 'CCL';

export interface Account {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
