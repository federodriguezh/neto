import { useState, useEffect } from 'react';
import { getHistoricalPricesForSymbol } from '../db';

export function useYesterdayCloses(symbols: string[]) {
  const [yesterdayPrices, setYesterdayPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const result: Record<string, number> = {};
      const today = new Date().toISOString().split('T')[0];
      for (const symbol of symbols) {
        const prices = await getHistoricalPricesForSymbol(symbol);
        const beforeToday = prices.filter((p) => p.date < today);
        if (beforeToday.length > 0) {
          result[symbol] = beforeToday[beforeToday.length - 1].close;
        }
      }
      setYesterdayPrices(result);
    }
    if (symbols.length > 0) {
      load();
    }
  }, [symbols.join(',')]);

  return yesterdayPrices;
}
