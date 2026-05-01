import type { DisplayCurrency } from '../types';

export function formatCurrency(value: number, currency: DisplayCurrency): string {
  const symbol = currency === 'ARS' ? '$' : 'US$';
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: currency === 'ARS' ? 0 : 2,
  });
  return `${symbol}${formatted}`;
}

export function formatCurrencyCompact(value: number, currency: DisplayCurrency): string {
  const symbol = currency === 'ARS' ? '$' : 'US$';
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}k`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

export function convertArsToUsd(valueInArs: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0;
  return valueInArs / exchangeRate;
}
