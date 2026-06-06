import { describe, it, expect } from 'vitest';
import { normalizeDate } from '../utils/date';

describe('normalizeDate', () => {
  it('returns strict ISO dates unchanged', () => {
    expect(normalizeDate('2024-01-15')).toBe('2024-01-15');
    expect(normalizeDate('2023-12-31')).toBe('2023-12-31');
  });

  it('pads single-digit month/day in loose ISO', () => {
    expect(normalizeDate('2024-1-5')).toBe('2024-01-05');
    expect(normalizeDate('2024-12-5')).toBe('2024-12-05');
    expect(normalizeDate('2024-1-15')).toBe('2024-01-15');
  });

  it('converts DD/MM/YYYY to ISO', () => {
    expect(normalizeDate('15/01/2024')).toBe('2024-01-15');
    expect(normalizeDate('5/3/2024')).toBe('2024-03-05');
  });

  it('trims whitespace', () => {
    expect(normalizeDate('  2024-01-15  ')).toBe('2024-01-15');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate('not-a-date')).toBeNull();
    expect(normalizeDate('abc')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(normalizeDate(null as unknown as string)).toBeNull();
    expect(normalizeDate(undefined as unknown as string)).toBeNull();
  });
});
