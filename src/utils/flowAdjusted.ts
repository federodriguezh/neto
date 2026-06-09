import type { Transaction, PortfolioHistory } from '../types';

/**
 * Compute a flow-adjusted portfolio return index.
 *
 * For each day, we remove the effect of buys/sells so that the return
 * reflects pure market performance, making the series comparable to a
 * benchmark like SPY.
 *
 * Formula (beginning-of-day cash-flow assumption):
 *   r_t = MV_t / (MV_{t-1} + CF_t) - 1
 * where CF_t = sum(buy gross cash outflows) - sum(sell net inflows) on day t.
 */
export function computeFlowAdjustedIndex(
  history: PortfolioHistory[],
  transactions: Transaction[]
): PortfolioHistory[] {
  if (history.length === 0) return [];

  // Build a map of date -> net cash flow
  const cfMap = new Map<string, number>();
  for (const tx of transactions) {
    const existing = cfMap.get(tx.date) ?? 0;
    const price = tx.priceArs ?? tx.price;
    const fees = tx.feesArs ?? tx.fees;
    if (tx.type === 'buy') {
      const buyOutflow = tx.quantity * price + fees;
      cfMap.set(tx.date, existing + buyOutflow);
    } else {
      const sellInflow = tx.quantity * price - fees;
      cfMap.set(tx.date, existing - sellInflow);
    }
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  const index: PortfolioHistory[] = [];
  let currentIndex = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      index.push({ date: sorted[i].date, value: currentIndex });
      continue;
    }

    const prev = sorted[i - 1];
    const curr = sorted[i];
    const cf = cfMap.get(curr.date) ?? 0;
    const denominator = prev.value + cf;

    let dailyReturn = 0;
    if (denominator > 0) {
      dailyReturn = curr.value / denominator - 1;
    }

    currentIndex = currentIndex * (1 + dailyReturn);
    index.push({ date: curr.date, value: currentIndex });
  }

  return index;
}
