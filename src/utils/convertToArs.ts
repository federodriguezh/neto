/**
 * Convert transaction prices/fees from MEP/CCL to ARS using historical rates.
 * Falls back to nearest available date (backward, then forward).
 * Unknown currencies are kept as-is with a warning.
 */
import { getExchangeRateForDate } from '../api/exchangeRates';

export async function convertTransactionToArs(
  date: string,
  price: number,
  fees: number,
  currency: string
): Promise<{ price: number; fees: number; currency: string }> {
  const normalized = currency.toUpperCase().trim();
  if (normalized === 'ARS' || !normalized) {
    return { price, fees, currency: 'ARS' };
  }

  if (normalized === 'MEP' || normalized === 'CCL') {
    const rate = await getExchangeRateForDate(
      normalized.toLowerCase() as 'mep' | 'ccl',
      date
    );
    if (rate !== undefined) {
      return {
        price: price * rate,
        fees: fees * rate,
        currency: 'ARS',
      };
    }
    console.warn(
      `[convertToArs] No exchange rate found for ${normalized} on ${date}; keeping price as-is`
    );
    return { price, fees, currency: 'ARS' };
  }

  console.warn(
    `[convertToArs] Unknown currency "${normalized}" for ${date}; keeping price as-is`
  );
  return { price, fees, currency: 'ARS' };
}
