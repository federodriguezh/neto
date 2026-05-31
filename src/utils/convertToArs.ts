/**
 * Convert transaction prices/fees from MEP/CCL to ARS using historical rates.
 * Refuses to silently relabel unconverted values as ARS.
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
    throw new Error(`No exchange rate found for ${normalized} on ${date}`);
  }

  throw new Error(`Unsupported currency "${normalized}" for ${date}`);
}
