export interface Data912LiveItem {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  last_update: string;
}

export interface Data912LiveResponse {
  data: Data912LiveItem[];
}

export interface Data912HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Data912HistoricalResponse {
  data: Data912HistoricalBar[];
}

export type PriceMap = Record<string, number>;
