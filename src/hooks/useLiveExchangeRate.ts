import { useState, useEffect } from 'react';
import { fetchLiveExchangeRate } from '../api/exchangeRates';

export function useLiveExchangeRate(type: 'mep' | 'ccl' | null) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) {
      setRate(null);
      setError(null);
      return;
    }

    const rateType = type;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const value = await fetchLiveExchangeRate(rateType);
        if (!cancelled) {
          setRate(value);
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
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [type]);

  return { rate, loading, error };
}
