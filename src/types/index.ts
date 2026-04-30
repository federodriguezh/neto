export type AssetClass = 'arg_stocks' | 'arg_cedears' | 'arg_bonds';
export type TransactionType = 'buy' | 'sell';

export interface Account {
  id?: number;
  name: string;
  createdAt: string;
  feeType: 'fixed' | 'percentage';
  feeValue: number;
}

export interface Transaction {
  id?: number;
  date: string;
  accountId: number;
  symbol: string;
  assetClass: AssetClass;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  realizedPnl?: number;
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

export interface Holding {
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnl: number;
}
