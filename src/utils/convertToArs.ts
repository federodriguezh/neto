/**
 * Convert transaction prices/fees from MEP/CCL/USD to ARS using historical rates.
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

  if (normalized === 'MEP' || normalized === 'CCL' || normalized === 'USD') {
    // Use MEP rate for USD as a reasonable proxy
    const rateType = normalized === 'CCL' ? 'ccl' : 'mep';
    const rate = await getExchangeRateForDate(rateType, date);
    if (rate !== undefined) {
      return {
        price: price * rate,
        fees: fees * rate,
        currency: 'ARS',
      };
    }
    throw new Error(`No exchange rate found for ${rateType} on ${date}`);
  }

  throw new Error(`Unsupported currency "${normalized}" for ${date}`);
}

export async function convertAmountToArs(
  date: string,
  amount: number,
  currency: string
): Promise<number> {
  const normalized = currency.toUpperCase().trim();
  if (normalized === 'ARS' || !normalized) {
    return amount;
  }

  const rateType = normalized === 'CCL' ? 'ccl' : 'mep';
  const rate = await getExchangeRateForDate(rateType, date);
  if (rate !== undefined) {
    return amount * rate;
  }
  throw new Error(`No exchange rate found for ${rateType} on ${date}`);
}
