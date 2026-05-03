import type { Transaction } from '../types';

interface BuyLot {
  quantity: number;
  price: number;
  fees: number;
  remainingQuantity: number;
}

export interface PnlDiagnostics {
  symbol: string;
  sellDate: string;
  sellQty: number;
  unmatchedQty: number;
}

/**
 * Batch-compute realized P&L for ALL sell transactions using FIFO.
 * Returns a Map<transactionId, realizedPnl>.
 *
 * Unlike the old stateless function, this correctly tracks consumed buy
 * lots across multiple sells of the same symbol.
 */
export function recalculateAllRealizedPnl(
  transactions: Transaction[]
): { pnls: Map<string, number>; diagnostics: PnlDiagnostics[] } {
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.createdAt !== b.createdAt) return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    return a.id.localeCompare(b.id);
  });

  const buyQueues = new Map<string, BuyLot[]>();
  const pnls = new Map<string, number>();
  const diagnostics: PnlDiagnostics[] = [];

  for (const tx of sorted) {
    if (tx.type === 'buy') {
      const queue = buyQueues.get(tx.symbol) ?? [];
      queue.push({
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees,
        remainingQuantity: tx.quantity,
      });
      buyQueues.set(tx.symbol, queue);
    } else if (tx.type === 'sell') {
      const queue = buyQueues.get(tx.symbol) ?? [];
      let remainingSellQty = tx.quantity;
      let costBasis = 0;

      while (remainingSellQty > 0 && queue.length > 0) {
        const lot = queue[0];
        const consumedQty = Math.min(remainingSellQty, lot.remainingQuantity);
        const proportionalFees = (consumedQty / lot.quantity) * lot.fees;
        costBasis += consumedQty * lot.price + proportionalFees;
        remainingSellQty -= consumedQty;
        lot.remainingQuantity -= consumedQty;

        if (lot.remainingQuantity <= 0) {
          queue.shift();
        }
      }

      if (remainingSellQty > 0) {
        diagnostics.push({
          symbol: tx.symbol,
          sellDate: tx.date,
          sellQty: tx.quantity,
          unmatchedQty: remainingSellQty,
        });
      }

      const proceeds = tx.quantity * tx.price - tx.fees;
      pnls.set(tx.id, proceeds - costBasis);
    }
  }

  return { pnls, diagnostics };
}
