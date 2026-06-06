import { describe, it, expect } from 'vitest';
import { convertArsToUsd, formatCurrencyCompact } from '../utils/currency';

describe('convertArsToUsd', () => {
  it('divides by exchange rate', () => {
    expect(convertArsToUsd(1000, 1000)).toBe(1);
    expect(convertArsToUsd(5000, 1000)).toBe(5);
  });

  it('returns 0 for zero or negative rate', () => {
    expect(convertArsToUsd(1000, 0)).toBe(0);
    expect(convertArsToUsd(1000, -1)).toBe(0);
  });

  it('handles fractional results', () => {
    expect(convertArsToUsd(1500, 1000)).toBe(1.5);
  });
});

describe('formatCurrencyCompact', () => {
  it('formats millions with M suffix', () => {
    const result = formatCurrencyCompact(1_500_000, 'ARS');
    expect(result).toContain('1.5M');
    expect(result).toContain('$');
  });

  it('formats thousands with k suffix', () => {
    const result = formatCurrencyCompact(5_000, 'ARS');
    expect(result).toContain('5k');
  });

  it('formats small values without suffix', () => {
    const result = formatCurrencyCompact(500, 'ARS');
    expect(result).toContain('500');
  });

  it('uses US$ for USD currencies', () => {
    const result = formatCurrencyCompact(1_500_000, 'MEP');
    expect(result).toContain('US$');
  });

  it('handles negative values', () => {
    const result = formatCurrencyCompact(-2_000_000, 'ARS');
    expect(result).toContain('-2.0M');
  });
});
