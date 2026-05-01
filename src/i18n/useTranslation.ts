import { useState, useEffect, useCallback } from 'react';
import { getPreference, setPreference } from '../db';
import { en, es } from './dictionary';

const DICTIONARIES: Record<string, Record<string, string>> = { en, es };

function detectLanguage(): string {
  const nav = navigator.language;
  if (nav.startsWith('es')) return 'es';
  return 'en';
}

export function useTranslation() {
  const [lang, setLangState] = useState<string>('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const pref = await getPreference('language');
      if (pref && (pref.value === 'en' || pref.value === 'es')) {
        setLangState(pref.value);
      } else {
        setLangState(detectLanguage());
      }
      setLoading(false);
    }
    init();
  }, []);

  const setLanguage = useCallback(async (language: 'en' | 'es') => {
    setLangState(language);
    await setPreference('language', language);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      const dict = DICTIONARIES[lang] ?? en;
      let text = dict[key] ?? en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{{${k}}}`, v);
        }
      }
      return text;
    },
    [lang]
  );

  return { t, lang, setLanguage, loading };
}
