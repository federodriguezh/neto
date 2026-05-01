interface SpyJsonItem {
  date: string;
  adjClose: number;
}

export interface SpyBar {
  date: string;
  close: number;
}

let cache: SpyBar[] | null = null;

export async function fetchSpyHistory(): Promise<SpyBar[]> {
  if (cache) return cache;

  const response = await fetch('./data/spy.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch SPY data: ${response.status}`);
  }

  const raw = (await response.json()) as SpyJsonItem[];
  cache = raw.map((item) => ({
    date: item.date,
    close: item.adjClose,
  }));

  return cache;
}
