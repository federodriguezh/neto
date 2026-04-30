import type { AssetClass } from '../types';
import type {
  Data912LiveResponse,
  Data912HistoricalResponse,
  PriceMap,
} from './types';
import {
  getPriceCache,
  putPriceCache,
  putHistoricalPrices,
} from '../db';

const BASE_URL = 'https://data912.com';
const MIN_REQUEST_INTERVAL_MS = 500;
const LIVE_CACHE_TTL_MS = 60_000;

let lastRequestTime = 0;
const pendingRequests: (() => void)[] = [];

function scheduleNextRequest(): void {
  if (pendingRequests.length === 0) return;
  const now = Date.now();
  const delay = Math.max(0, lastRequestTime + MIN_REQUEST_INTERVAL_MS - now);
  setTimeout(() => {
    lastRequestTime = Date.now();
    const next = pendingRequests.shift();
    if (next) next();
    scheduleNextRequest();
  }, delay);
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingRequests.push(() => {
      fn().then(resolve).catch(reject);
    });
    if (pendingRequests.length === 1) {
      scheduleNextRequest();
    }
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

const LIVE_ENDPOINTS: Record<AssetClass, string> = {
  arg_stocks: '/live/arg_stocks',
  arg_cedears: '/live/arg_cedears',
  usa_stocks: '/live/usa_stocks',
  usa_adrs: '/live/usa_adrs',
};

function getHistoricalEndpoint(symbol: string, assetClass: AssetClass): string | null {
  if (assetClass === 'arg_stocks') return `/historical/stocks/${symbol}`;
  if (assetClass === 'arg_cedears') return `/historical/cedears/${symbol}`;
  return null;
}

export async function fetchLivePrices(assetClass: AssetClass): Promise<PriceMap> {
  const now = Date.now();

  const endpoint = LIVE_ENDPOINTS[assetClass];
  const data = await enqueueRequest(() =>
    fetchJson<Data912LiveResponse>(`${BASE_URL}${endpoint}`)
  );

  const priceMap: PriceMap = {};
  for (const item of data.data) {
    priceMap[item.ticker] = item.price;
    await putPriceCache({
      symbol: item.ticker,
      price: item.price,
      timestamp: now,
    });
  }

  return priceMap;
}

export async function fetchLivePricesForSymbols(
  symbols: string[],
  assetClasses: AssetClass[]
): Promise<PriceMap> {
  const now = Date.now();
  const priceMap: PriceMap = {};

  // Check cache first
  for (const symbol of symbols) {
    const cached = await getPriceCache(symbol);
    if (cached && now - cached.timestamp < LIVE_CACHE_TTL_MS) {
      priceMap[symbol] = cached.price;
    }
  }

  const missingSymbols = symbols.filter((s) => priceMap[s] === undefined);
  if (missingSymbols.length === 0) return priceMap;

  // Determine which asset classes to fetch
  const classesToFetch = new Set<AssetClass>();
  for (let i = 0; i < symbols.length; i++) {
    if (missingSymbols.includes(symbols[i])) {
      classesToFetch.add(assetClasses[i]);
    }
  }

  // Fetch live prices for each missing asset class
  for (const assetClass of classesToFetch) {
    const classPrices = await fetchLivePrices(assetClass);
    Object.assign(priceMap, classPrices);
  }

  return priceMap;
}

export interface HistoricalBar {
  date: string;
  close: number;
}

export async function fetchHistoricalPrices(
  symbol: string,
  assetClass: AssetClass
): Promise<HistoricalBar[]> {
  const endpoint = getHistoricalEndpoint(symbol, assetClass);
  if (!endpoint) {
    // USA stocks/ADRs have no historical endpoint
    return [];
  }

  const data = await enqueueRequest(() =>
    fetchJson<Data912HistoricalResponse>(`${BASE_URL}${endpoint}`)
  );

  const bars = data.data.map((bar) => ({
    date: bar.date,
    close: bar.close,
  }));

  await putHistoricalPrices(
    bars.map((b) => ({ symbol, date: b.date, close: b.close }))
  );

  return bars;
}


