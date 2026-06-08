import { useState, useEffect } from 'react';
import type { PortfolioHistory, DisplayCurrency } from '../types';
import { getExchangeRatesForType } from '../db';

export function useConvertedHistory(
  history: PortfolioHistory[],
  displayCurrency: DisplayCurrency
) {
  const [converted, setConverted] = useState<PortfolioHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function convert() {
      if (displayCurrency === 'ARS' || history.length === 0) {
        setConverted(history);
        return;
      }

      setLoading(true);
      const type = displayCurrency === 'MEP' ? 'mep' : 'ccl';

      const allRates = await getExchangeRatesForType(type);
      const rateMap = new Map<string, number>();
      for (const r of allRates) {
        rateMap.set(r.date, r.rate);
      }

      const sortedRates = [...allRates].sort((a, b) => a.date.localeCompare(b.date));
      const result: PortfolioHistory[] = [];

      for (const entry of history) {
        let rate: number | undefined = rateMap.get(entry.date);

        if (rate === undefined) {
          const before = sortedRates.filter((r) => r.date < entry.date);
          if (before.length > 0) {
            rate = before[before.length - 1].rate;
          } else {
            const after = sortedRates.filter((r) => r.date > entry.date);
            if (after.length > 0) rate = after[0].rate;
          }
        }

        if (rate !== undefined) {
          result.push({ date: entry.date, value: entry.value / rate });
        }
      }

      setConverted(result);
      setLoading(false);
    }

    convert();
  }, [history, displayCurrency]);

  return { convertedHistory: converted, loading };
}
