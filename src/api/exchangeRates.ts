import type { ExchangeRate } from '../types';
import { getExchangeRatesForType, putExchangeRates } from '../db';

const LIVE_BASE_URL = 'https://dolarapi.com/v1/dolares';
const HISTORICAL_BASE_URL = 'https://api.argentinadatos.com/v1/cotizaciones/dolares';

interface DolarApiLiveResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface ArgentinaDatosHistoricalItem {
  moneda: string;
  casa: string;
  fecha: string;
  compra: number;
  venta: number;
}

function casaFromType(type: 'mep' | 'ccl'): string {
  return type === 'mep' ? 'bolsa' : 'contadoconliqui';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchLiveExchangeRate(type: 'mep' | 'ccl'): Promise<number> {
  const casa = casaFromType(type);
  const data = await fetchJson<DolarApiLiveResponse>(`${LIVE_BASE_URL}/${casa}`);
  return data.venta;
}

export async function fetchHistoricalExchangeRates(type: 'mep' | 'ccl'): Promise<void> {
  const casa = casaFromType(type);
  const items = await fetchJson<ArgentinaDatosHistoricalItem[]>(`${HISTORICAL_BASE_URL}/${casa}`);

  const rates: ExchangeRate[] = items.map((item) => ({
    type,
    date: item.fecha,
    rate: item.venta,
  }));

  await putExchangeRates(rates);
}

export async function ensureHistoricalExchangeRates(type: 'mep' | 'ccl'): Promise<void> {
  const existing = await getExchangeRatesForType(type);
  if (existing.length > 0) return;
  await fetchHistoricalExchangeRates(type);
}

export async function getExchangeRateForDate(
  type: 'mep' | 'ccl',
  targetDate: string
): Promise<number | undefined> {
  const allRates = await getExchangeRatesForType(type);
  if (allRates.length === 0) return undefined;

  // Exact match
  const exact = allRates.find((r) => r.date === targetDate);
  if (exact) return exact.rate;

  // Backward-fill only: latest rate before target date
  const before = allRates.filter((r) => r.date < targetDate);
  if (before.length > 0) {
    return before[before.length - 1].rate;
  }

  return undefined;
}
