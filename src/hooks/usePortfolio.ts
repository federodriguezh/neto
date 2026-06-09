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

    const { holdings, shortPositions } = useMemo(() => {
    const map = new Map<string, { quantity: number; totalCost: number; assetClass: AssetClass }>();

    for (const tx of transactions) {
      const key = tx.symbol;
      const existing = map.get(key);
      const price = tx.priceArs ?? tx.price;
      const fees = tx.feesArs ?? tx.fees;
      if (!existing) {
        map.set(key, {
          quantity: tx.type === 'buy' ? tx.quantity : -tx.quantity,
          totalCost: tx.type === 'buy' ? tx.quantity * price + fees : -(tx.quantity * price - fees),
          assetClass: tx.assetClass,
        });
      } else {
        if (tx.type === 'buy') {
          existing.quantity += tx.quantity;
          existing.totalCost += tx.quantity * price + fees;
        } else {
          // Sell: remove proportional cost basis instead of sale proceeds
          const avgCostBefore = existing.totalCost / existing.quantity;
          existing.quantity -= tx.quantity;
          existing.totalCost -= tx.quantity * avgCostBefore;
        }
      }
    }

    const result: Holding[] = [];
    const shorts: { symbol: string; assetClass: AssetClass; quantity: number }[] = [];
    const EPSILON = 1e-9;

    for (const [symbol, data] of map.entries()) {
      if (data.quantity > EPSILON) {
        const avgCost = data.totalCost / data.quantity;
        result.push({
          symbol,
          assetClass: data.assetClass,
          quantity: data.quantity,
          avgCost,
          marketValue: 0,
          unrealizedPnl: 0,
        });
      } else if (data.quantity < -EPSILON) {
        shorts.push({ symbol, assetClass: data.assetClass, quantity: data.quantity });
      }
    }

    return { holdings: result, shortPositions: shorts };
  }, [transactions]);

  const totalRealizedPnl = useMemo(() => {
    return transactions.reduce((sum, tx) => {
      return tx.type === 'sell' && tx.realizedPnl !== undefined ? sum + tx.realizedPnl : sum;
    }, 0);
  }, [transactions]);

  return { holdings, transactions, totalRealizedPnl, loading, refresh, shortPositions };
}
