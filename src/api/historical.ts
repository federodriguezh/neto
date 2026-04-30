import type { AssetClass } from '../types';
import type { HistoricalBar } from './data912';
import { fetchData912HistoricalPrices } from './data912';
import { fetchYahooHistoricalPrices } from './yahoo';

export { type HistoricalBar } from './data912';

export async function fetchHistoricalPrices(
  symbol: string,
  assetClass: AssetClass
): Promise<HistoricalBar[]> {
  if (assetClass === 'arg_cedears') {
    const yahooBars = await fetchYahooHistoricalPrices(symbol);
    if (yahooBars.length > 0) {
      return yahooBars;
    }
    return fetchData912HistoricalPrices(symbol, assetClass);
  }

  return fetchData912HistoricalPrices(symbol, assetClass);
}
