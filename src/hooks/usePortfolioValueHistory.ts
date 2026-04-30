import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AssetClass, PortfolioHistory, Transaction, HistoricalPrice } from '../types';
import {
  getTransactions,
  getHistoricalPricesForSymbol,
  putHistoricalPrices,
  putPortfolioHistory,
  clearPortfolioHistory,
} from '../db';
import { fetchHistoricalPrices, fetchLivePricesForSymbols } from '../api/data912';

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
  for (const [symbol, data] of map.entries()) {
    if (data.quantity > 0) {
      result.push({ symbol, assetClass: data.assetClass, quantity: data.quantity });
    }
  }
  return result;
}

async function buildPriceIndex(
  symbols: string[],
  assetClasses: AssetClass[]
): Promise<Map<string, HistoricalPrice[]>> {
  const index = new Map<string, HistoricalPrice[]>();
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const assetClass = assetClasses[i];
    let prices = await getHistoricalPricesForSymbol(symbol);

    // For ARG assets, fetch historical if we have none
    if ((assetClass === 'arg_stocks' || assetClass === 'arg_cedears') && prices.length === 0) {
      try {
        await fetchHistoricalPrices(symbol, assetClass);
        prices = await getHistoricalPricesForSymbol(symbol);
      } catch {
        // ignore fetch errors
      }
    }

    // For USA assets, snapshot today's live price if not present
    if ((assetClass === 'usa_stocks' || assetClass === 'usa_adrs')) {
      const today = new Date().toISOString().split('T')[0];
      const hasToday = prices.some((p) => p.date === today);
      if (!hasToday) {
        try {
          const liveMap = await fetchLivePricesForSymbols([symbol], [assetClass]);
          const price = liveMap[symbol];
          if (price !== undefined) {
            await putHistoricalPrices([{ symbol, date: today, close: price }]);
            prices = await getHistoricalPricesForSymbol(symbol);
          }
        } catch {
          // ignore fetch errors
        }
      }
    }

    index.set(symbol, prices);
  }
  return index;
}

function findPriceForwardFill(
  prices: HistoricalPrice[],
  targetDate: string
): number | undefined {
  // Exact match
  const exact = prices.find((p) => p.date === targetDate);
  if (exact) return exact.close;

  // Forward-fill: earliest price after target date
  const after = prices.filter((p) => p.date > targetDate);
  if (after.length > 0) {
    return after[0].close;
  }

  // Backward-fill as last resort: latest price before target date
  const before = prices.filter((p) => p.date < targetDate);
  if (before.length > 0) {
    return before[before.length - 1].close;
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
      const priceIndex = await buildPriceIndex(symbols, assetClasses);

      // Compute daily values
      const dailyValues: PortfolioHistory[] = [];
      for (const date of allDates) {
        const holdings = replayTransactions(transactions, date);
        let totalValue = 0;
        for (const h of holdings) {
          const prices = priceIndex.get(h.symbol) ?? [];
          const price = findPriceForwardFill(prices, date);
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
