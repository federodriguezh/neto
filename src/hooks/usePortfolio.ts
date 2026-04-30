import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AssetClass, Transaction, Holding } from '../types';
import { getTransactionsUpToDate } from '../db';

export function usePortfolio(date?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getTransactionsUpToDate(targetDate);
    setTransactions(data);
    setLoading(false);
  }, [targetDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const holdings = useMemo(() => {
    const map = new Map<string, { quantity: number; totalCost: number; assetClass: AssetClass }>();

    for (const tx of transactions) {
      const key = tx.symbol;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          quantity: tx.type === 'buy' ? tx.quantity : -tx.quantity,
          totalCost: tx.type === 'buy' ? tx.quantity * tx.price + tx.fees : -(tx.quantity * tx.price - tx.fees),
          assetClass: tx.assetClass,
        });
      } else {
        if (tx.type === 'buy') {
          existing.quantity += tx.quantity;
          existing.totalCost += tx.quantity * tx.price + tx.fees;
        } else {
          existing.quantity -= tx.quantity;
          existing.totalCost -= tx.quantity * tx.price - tx.fees;
        }
      }
    }

    const result: Holding[] = [];
    for (const [symbol, data] of map.entries()) {
      if (data.quantity <= 0) continue;
      const avgCost = data.totalCost / data.quantity;
      result.push({
        symbol,
        assetClass: data.assetClass,
        quantity: data.quantity,
        avgCost,
        marketValue: 0,
        unrealizedPnl: 0,
      });
    }

    return result;
  }, [transactions]);

  return { holdings, loading, refresh };
}
