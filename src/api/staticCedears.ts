import { putHistoricalPrices } from '../db';

export interface StaticCedearBar {
  date: string;
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

    const data = (await response.json()) as Record<string, number>;
    if (!data || typeof data !== 'object') {
      return [];
    }

    const bars: StaticCedearBar[] = [];
    for (const [date, close] of Object.entries(data)) {
      if (typeof close === 'number') {
        bars.push({ date, close });
      }
    }

    bars.sort((a, b) => a.date.localeCompare(b.date));

    await putHistoricalPrices(
      bars.map((b) => ({ symbol, date: b.date, close: b.close }))
    );

    return bars;
  } catch (e) {
    console.error(`Failed to fetch static CEDEAR history for ${symbol}:`, e);
    return [];
  }
}
