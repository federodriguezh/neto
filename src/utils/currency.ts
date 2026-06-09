import type { DisplayCurrency } from '../types';

function getSymbol(currency: string): string {
  const upper = currency.toUpperCase();
  if (upper === 'ARS') return '$';
  if (upper === 'USD' || upper === 'MEP' || upper === 'CCL') return 'US$';
  return upper;
}

function getFractionDigits(currency: string): number {
  const upper = currency.toUpperCase();
  return upper === 'ARS' ? 0 : 2;
}

export function formatCurrency(value: number, currency: DisplayCurrency): string {
  return formatCurrencyItem(value, currency);
}

export function formatCurrencyItem(value: number, itemCurrency: string): string {
  const symbol = getSymbol(itemCurrency);
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: getFractionDigits(itemCurrency),
  });
  return `${symbol}${formatted}`;
}

export function formatCurrencyCompact(value: number, currency: DisplayCurrency): string {
  const symbol = getSymbol(currency);
  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}k`;
  }
  return `${symbol}${value.toFixed(getFractionDigits(currency))}`;
}

export function convertArsToUsd(valueInArs: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0;
  return valueInArs / exchangeRate;
}
