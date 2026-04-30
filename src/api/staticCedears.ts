import { putHistoricalPrices } from '../db';

export interface StaticCedearBar {
  date: string;
  open?: number;
  close: number;
}

export async function fetchStaticCedearHistory(
  symbol: string
): Promise<StaticCedearBar[]> {
  try {
    const response = await fetch(`./data/cedears/${encodeURIComponent(symbol)}.json`);
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }

    const bars: StaticCedearBar[] = [];
    for (const item of data) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.date === 'string' &&
        typeof item.close === 'number'
      ) {
        bars.push({
          date: item.date,
          open: typeof item.open === 'number' ? item.open : undefined,
          close: item.close,
        });
      }
    }

    bars.sort((a, b) => a.date.localeCompare(b.date));

    await putHistoricalPrices(
      bars.map((b) => ({ symbol, date: b.date, open: b.open, close: b.close }))
    );

    return bars;
  } catch (e) {
    console.error(`Failed to fetch static CEDEAR history for ${symbol}:`, e);
    return [];
  }
}
