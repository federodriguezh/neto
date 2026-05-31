import { useState, useEffect } from 'react';
import type { PortfolioHistory, DisplayCurrency } from '../types';
import { getExchangeRateForDate } from '../api/exchangeRates';

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
      const result: PortfolioHistory[] = [];

      for (const entry of history) {
        const rate = await getExchangeRateForDate(type, entry.date);
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
