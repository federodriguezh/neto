import { useState, useEffect } from 'react';
import type { PortfolioHistory } from '../types';
import { fetchSpyHistory } from '../api/spy';

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

export function useSpyComparison(portfolioHistory: PortfolioHistory[], enabled: boolean) {
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

        const sortedSpy = [...spyBars].sort((a, b) => a.date.localeCompare(b.date));

        const merged: ComparisonPoint[] = [];
        for (const entry of portfolioHistory) {
          const spyPrice = findPriceBackwardFill(sortedSpy, entry.date);
          if (spyPrice !== undefined) {
            merged.push({
              date: entry.date,
              portfolio: entry.value,
              spy: spyPrice,
            });
          }
        }

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
  }, [portfolioHistory, enabled]);

  return { data, loading };
}
