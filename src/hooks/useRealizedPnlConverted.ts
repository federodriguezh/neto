import { useState, useEffect } from 'react';
import type { Transaction, DisplayCurrency } from '../types';
import { getExchangeRateForDate } from '../api/exchangeRates';

export function useRealizedPnlConverted(
  transactions: Transaction[],
  displayCurrency: DisplayCurrency
) {
  const [convertedPnl, setConvertedPnl] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function convert() {
      if (displayCurrency === 'ARS') {
        const total = transactions.reduce((sum, tx) => {
          return tx.type === 'sell' && tx.realizedPnl !== undefined ? sum + tx.realizedPnl : sum;
        }, 0);
        setConvertedPnl(total);
        return;
      }

      setLoading(true);
      const type = displayCurrency === 'MEP' ? 'mep' : 'ccl';
      let total = 0;

      for (const tx of transactions) {
        if (tx.type !== 'sell' || tx.realizedPnl === undefined) continue;
        const rate = await getExchangeRateForDate(type, tx.date);
        if (rate !== undefined && rate > 0) {
          total += tx.realizedPnl / rate;
        } else {
          total += tx.realizedPnl;
        }
      }

      setConvertedPnl(total);
      setLoading(false);
    }

    convert();
  }, [transactions, displayCurrency]);

  return { convertedPnl, loading };
}
