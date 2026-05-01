import { useState, useEffect, useCallback } from 'react';
import type { DisplayCurrency } from '../types';
import { getPreference, setPreference } from '../db';
import { ensureHistoricalExchangeRates } from '../api/exchangeRates';

const PREF_KEY = 'displayCurrency';

export function useDisplayCurrency() {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>('ARS');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const pref = await getPreference(PREF_KEY);
      if (pref && (pref.value === 'ARS' || pref.value === 'MEP' || pref.value === 'CCL')) {
        setDisplayCurrencyState(pref.value);
      }
      setLoading(false);
    }
    load();
  }, []);

  const setDisplayCurrency = useCallback(async (currency: DisplayCurrency) => {
    setDisplayCurrencyState(currency);
    await setPreference(PREF_KEY, currency);
    if (currency === 'MEP' || currency === 'CCL') {
      const type = currency === 'MEP' ? 'mep' : 'ccl';
      await ensureHistoricalExchangeRates(type);
    }
  }, []);

  return { displayCurrency, setDisplayCurrency, loading };
}
