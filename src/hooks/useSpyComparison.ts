import { useState, useEffect } from 'react';
import type { PortfolioHistory, Transaction, DisplayCurrency } from '../types';
import { fetchSpyHistory } from '../api/spy';
import { computeFlowAdjustedIndex } from '../utils/flowAdjusted';
import { getExchangeRatesForType } from '../db';

export interface ComparisonPoint {
  date: string;
  portfolio: number;
  spy: number;
}

function findPriceBackwardFill(
  prices: Array<{ date: string; close: number }>,
  targetDate: string
): number | undefined {
  const exact = prices.find((p) => p.date === targetDate);
  if (exact) return exact.close;

  const before = prices.filter((p) => p.date < targetDate);
  if (before.length > 0) return before[before.length - 1].close;

  const after = prices.filter((p) => p.date > targetDate);
  if (after.length > 0) return after[0].close;

  return undefined;
}

function computeSpyIndex(spyBars: Array<{ date: string; close: number }>): PortfolioHistory[] {
  const sorted = [...spyBars].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  const index: PortfolioHistory[] = [];
  let current = 1;
  index.push({ date: sorted[0].date, value: current });

  for (let i = 1; i < sorted.length; i++) {
    const dailyReturn = sorted[i].close / sorted[i - 1].close - 1;
    current = current * (1 + dailyReturn);
    index.push({ date: sorted[i].date, value: current });
  }

  return index;
}

export function useSpyComparison(
  portfolioHistoryArs: PortfolioHistory[],
  transactions: Transaction[],
  displayCurrency: DisplayCurrency,
  enabled: boolean
) {
  const [data, setData] = useState<ComparisonPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || portfolioHistoryArs.length === 0) {
      setData([]);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const spyBars = await fetchSpyHistory();
        if (cancelled) return;

        const historyForComparison: PortfolioHistory[] = [];
        if (displayCurrency === 'ARS') {
          for (const entry of portfolioHistoryArs) {
            historyForComparison.push(entry);
          }
        } else {
          const type = displayCurrency === 'MEP' ? 'mep' : 'ccl';
          const allRates = await getExchangeRatesForType(type);
          const rateMap = new Map<string, number>();
          const sortedRates = [...allRates].sort((a, b) => a.date.localeCompare(b.date));
          for (const r of allRates) rateMap.set(r.date, r.rate);

          for (const entry of portfolioHistoryArs) {
            let rate: number | undefined = rateMap.get(entry.date);
            if (rate === undefined) {
              const before = sortedRates.filter((r) => r.date < entry.date);
              if (before.length > 0) rate = before[before.length - 1].rate;
              else {
                const after = sortedRates.filter((r) => r.date > entry.date);
                if (after.length > 0) rate = after[0].rate;
              }
            }
            if (rate !== undefined && rate > 0) {
              historyForComparison.push({ date: entry.date, value: entry.value / rate });
            }
          }
        }

        const txForComparison: Transaction[] = [];
        if (displayCurrency === 'ARS') {
          for (const tx of transactions) txForComparison.push(tx);
        } else {
          const type = displayCurrency === 'MEP' ? 'mep' : 'ccl';
          const allRates = await getExchangeRatesForType(type);
          const rateMap = new Map<string, number>();
          const sortedRates = [...allRates].sort((a, b) => a.date.localeCompare(b.date));
          for (const r of allRates) rateMap.set(r.date, r.rate);

          for (const tx of transactions) {
            let rate: number | undefined = rateMap.get(tx.date);
            if (rate === undefined) {
              const before = sortedRates.filter((r) => r.date < tx.date);
              if (before.length > 0) rate = before[before.length - 1].rate;
              else {
                const after = sortedRates.filter((r) => r.date > tx.date);
                if (after.length > 0) rate = after[0].rate;
              }
            }
            if (rate !== undefined && rate > 0) {
              txForComparison.push({ ...tx, price: tx.price / rate, fees: tx.fees / rate });
            }
          }
        }

        // Flow-adjusted portfolio index in selected display currency
        const portfolioIndex = computeFlowAdjustedIndex(historyForComparison, txForComparison);

        // SPY chained-return index
        const spyIndex = computeSpyIndex(spyBars);

        // Merge on date
        const merged: ComparisonPoint[] = [];
        for (const entry of portfolioIndex) {
          const spyValue = findPriceBackwardFill(
            spyIndex.map((s) => ({ date: s.date, close: s.value })),
            entry.date
          );
          if (spyValue !== undefined) {
            merged.push({
              date: entry.date,
              portfolio: entry.value,
              spy: spyValue,
            });
          }
        }

        // Align both to 1.0 at the earliest common date
        if (merged.length > 0 && !cancelled) {
          const firstPortfolio = merged[0].portfolio;
          const firstSpy = merged[0].spy;
          for (const m of merged) {
            m.portfolio = m.portfolio / firstPortfolio;
            m.spy = m.spy / firstSpy;
          }
        }

        if (!cancelled) {
          setData(merged);
        }
      } catch (e) {
        console.error('Failed to load SPY data:', e);
        if (!cancelled) setError('SPY data not available. Run the build scripts to generate it.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [portfolioHistoryArs, transactions, displayCurrency, enabled]);

  return { data, loading, error };
}
