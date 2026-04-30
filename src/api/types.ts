export interface Data912LiveItem {
  symbol: string;
  c: number;
  pct_change: number;
  v: number;
}

export type Data912LiveResponse = Data912LiveItem[];

export interface Data912HistoricalBar {
  date: string;
  c: number;
}

export type Data912HistoricalResponse = Data912HistoricalBar[];

export type PriceMap = Record<string, number>;
