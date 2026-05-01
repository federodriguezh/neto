import { useState, useEffect, useCallback, useRef } from 'react';
import type { AssetClass } from '../types';
import { fetchLivePricesForSymbols } from '../api/data912';

export function useLivePrices(symbols: string[], assetClasses: AssetClass[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pctChanges, setPctChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLivePricesForSymbols(symbols, assetClasses);
      setPrices(data.prices);
      setPctChanges(data.pctChanges);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [symbols, assetClasses]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (symbols.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLivePricesForSymbols(symbols, assetClasses);
        if (!cancelled) {
          setPrices(data.prices);
          setPctChanges(data.pctChanges);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [symbols.join(','), assetClasses.join(',')]);

  return { prices, pctChanges, loading, error, refetch: fetchPrices };
}
