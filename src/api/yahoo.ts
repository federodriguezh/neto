import { putHistoricalPrices } from '../db';

export interface YahooHistoricalBar {
  date: string;
  close: number;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
}

export async function fetchYahooHistoricalPrices(
  symbol: string
): Promise<YahooHistoricalBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.BA?interval=1d&range=max`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];

    if (!result || !Array.isArray(result.timestamp)) {
      return [];
    }

    const timestamps: number[] = result.timestamp;
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const bars: YahooHistoricalBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close === null || close === undefined) continue;

      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      bars.push({ date, close });
    }

    await putHistoricalPrices(
      bars.map((b) => ({ symbol, date: b.date, close: b.close }))
    );

    return bars;
  } catch (e) {
    console.error(`Failed to fetch Yahoo historical prices for ${symbol}:`, e);
    return [];
  }
}
