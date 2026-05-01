/**
 * Normalizes a date string to strict ISO YYYY-MM-DD.
 * Accepts:
 * - YYYY-MM-DD (already correct)
 * - YYYY-M-D (single-digit month/day)
 * - DD/MM/YYYY or D/M/YYYY
 * Returns null if unparseable.
 */
export function normalizeDate(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Already strict ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY-M-D, YYYY-MM-D, YYYY-M-DD (loose ISO)
  const looseIsoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (looseIsoMatch) {
    const [, year, month, day] = looseIsoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or D/M/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Fallback: native Date parsing (handles MM-DD-YYYY, etc.)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const iso = d.toISOString().split('T')[0];
    const parsedYear = parseInt(iso.split('-')[0], 10);
    if (parsedYear >= 2000 && parsedYear <= 2100) {
      return iso;
    }
  }

  return null;
}
