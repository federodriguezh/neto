import { useState, useEffect } from 'react';
import type { PortfolioHistory, Transaction } from '../types';
import { fetchSpyHistory } from '../api/spy';
import { computeFlowAdjustedIndex } from '../utils/flowAdjusted';

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
  portfolioHistory: PortfolioHistory[],
  transactions: Transaction[],
  enabled: boolean
) {
  const [data, setData] = useState<ComparisonPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || portfolioHistory.length === 0) {
      setData([]);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const spyBars = await fetchSpyHistory();
        if (cancelled) return;

        // Flow-adjusted portfolio index
        const portfolioIndex = computeFlowAdjustedIndex(portfolioHistory, transactions);

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
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [portfolioHistory, transactions, enabled]);

  return { data, loading };
}
