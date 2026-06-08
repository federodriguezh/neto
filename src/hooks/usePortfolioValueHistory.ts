import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AssetClass, PortfolioHistory, Transaction, HistoricalPrice } from '../types';
import {
  getTransactions,
  getHistoricalPricesForSymbol,
  putPortfolioHistory,
  clearPortfolioHistory,
} from '../db';
import { fetchHistoricalPrices } from '../api/historical';

interface DateHolding {
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
}

function getAllDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function replayTransactions(transactions: Transaction[], upToDate: string): DateHolding[] {
  const map = new Map<string, { quantity: number; assetClass: AssetClass }>();
  for (const tx of transactions) {
    if (tx.date > upToDate) continue;
    const key = tx.symbol;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        quantity: tx.type === 'buy' ? tx.quantity : -tx.quantity,
        assetClass: tx.assetClass,
      });
    } else {
      if (tx.type === 'buy') {
        existing.quantity += tx.quantity;
      } else {
        existing.quantity -= tx.quantity;
      }
    }
  }

  const result: DateHolding[] = [];
  const EPSILON = 1e-9;
  for (const [symbol, data] of map.entries()) {
    if (data.quantity > EPSILON) {
      result.push({ symbol, assetClass: data.assetClass, quantity: data.quantity });
    }
  }
  return result;
}

function mergeTransactionPrices(
  symbol: string,
  externalPrices: HistoricalPrice[],
  transactions: Transaction[]
): HistoricalPrice[] {
  const priceMap = new Map<string, HistoricalPrice>();

  for (const p of externalPrices) {
    priceMap.set(p.date, p);
  }

  for (const tx of transactions) {
    if (tx.symbol !== symbol) continue;
    if (!priceMap.has(tx.date)) {
      priceMap.set(tx.date, { symbol, date: tx.date, open: tx.price, close: tx.price });
    }
  }

  return Array.from(priceMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function buildPriceIndex(
  symbols: string[],
  assetClasses: AssetClass[],
  transactions: Transaction[]
): Promise<Map<string, HistoricalPrice[]>> {
  const index = new Map<string, HistoricalPrice[]>();

  const missingSymbols: { symbol: string; assetClass: AssetClass }[] = [];
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const assetClass = assetClasses[i];
    const cached = await getHistoricalPricesForSymbol(symbol);
    if (
      cached.length === 0 &&
      (assetClass === 'arg_stocks' || assetClass === 'arg_cedears' || assetClass === 'arg_bonds')
    ) {
      missingSymbols.push({ symbol, assetClass });
    }
  }

  if (missingSymbols.length > 0) {
    await Promise.all(
      missingSymbols.map(({ symbol, assetClass }) =>
        fetchHistoricalPrices(symbol, assetClass).catch((e) =>
          console.error(`Failed to fetch historical prices for ${symbol}:`, e)
        )
      )
    );
  }

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const externalPrices = await getHistoricalPricesForSymbol(symbol);
    const merged = mergeTransactionPrices(symbol, externalPrices, transactions);
    index.set(symbol, merged);
  }
  return index;
}

function findPriceBackwardFill(
  prices: HistoricalPrice[],
  targetDate: string
): number | undefined {
  // Exact match
  const exact = prices.find((p) => p.date === targetDate);
  if (exact) return exact.close;

  // Backward-fill: latest price before target date
  const before = prices.filter((p) => p.date < targetDate);
  if (before.length > 0) {
    return before[before.length - 1].close;
  }

  // Forward-fill as last resort: earliest price after target date
  const after = prices.filter((p) => p.date > targetDate);
  if (after.length > 0) {
    return after[0].close;
  }

  return undefined;
}

export function usePortfolioValueHistory() {
  const [history, setHistory] = useState<PortfolioHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const transactions = await getTransactions();
      if (transactions.length === 0) {
        setHistory([]);
        return;
      }

      const dates = transactions.map((t) => t.date).sort();
      const firstDate = dates[0];
      const today = new Date().toISOString().split('T')[0];
      const allDates = getAllDatesInRange(firstDate, today);

      // Collect all symbols ever held
      const symbolSet = new Map<string, AssetClass>();
      for (const tx of transactions) {
        symbolSet.set(tx.symbol, tx.assetClass);
      }
      const symbols = Array.from(symbolSet.keys());
      const assetClasses = symbols.map((s) => symbolSet.get(s)!);

      // Build price index
      const priceIndex = await buildPriceIndex(symbols, assetClasses, transactions);

      // Compute daily values
      const dailyValues: PortfolioHistory[] = [];
      for (const date of allDates) {
        const holdings = replayTransactions(transactions, date);
        let totalValue = 0;
        for (const h of holdings) {
          const prices = priceIndex.get(h.symbol) ?? [];
          const price = findPriceBackwardFill(prices, date);
          if (price !== undefined) {
            totalValue += h.quantity * price;
          }
        }
        dailyValues.push({ date, value: totalValue });
      }

      await clearPortfolioHistory();
      await putPortfolioHistory(dailyValues);
      setHistory(dailyValues);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    compute();
  }, [compute]);

  const filteredHistory = useMemo(() => {
    return history;
  }, [history]);

  return { history: filteredHistory, loading, recompute: compute };
}
