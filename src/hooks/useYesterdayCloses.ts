import { useState, useEffect } from 'react';
import { getHistoricalPricesForSymbol } from '../db';

export function useYesterdayCloses(symbols: string[]) {
  const [yesterdayPrices, setYesterdayPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result: Record<string, number> = {};
      const today = new Date().toISOString().split('T')[0];
      for (const symbol of symbols) {
        const prices = await getHistoricalPricesForSymbol(symbol);
        const beforeToday = prices.filter((p) => p.date < today);
        if (beforeToday.length > 0) {
          result[symbol] = beforeToday[beforeToday.length - 1].close;
        } else if (prices.length === 1 && prices[0].open !== undefined) {
          // Single data point (today): use open as proxy for yesterday's close
          result[symbol] = prices[0].open;
        }
      }
      setYesterdayPrices(result);
      setLoading(false);
    }
    if (symbols.length > 0) {
      load();
    } else {
      setYesterdayPrices({});
      setLoading(false);
    }
  }, [symbols.join(',')]);

  return { yesterdayPrices, loading };
}
