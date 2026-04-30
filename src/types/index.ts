export type AssetClass = 'arg_stocks' | 'arg_cedears' | 'usa_stocks' | 'usa_adrs';
export type TransactionType = 'buy' | 'sell';

export interface Account {
  id?: number;
  name: string;
  createdAt: string;
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
}

export interface HistoricalPrice {
  symbol: string;
  date: string;
  close: number;
}

export interface PortfolioHistory {
  date: string;
  value: number;
}

export interface PriceCacheEntry {
  symbol: string;
  price: number;
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
