import type { Transaction } from '../types';

export function calculateRealizedPnl(
  sellTx: Transaction,
  allTransactions: Transaction[]
): number {
  if (sellTx.type !== 'sell') return 0;

  const symbolTxs = allTransactions
    .filter((t) => t.symbol === sellTx.symbol)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.id ?? 0) - (b.id ?? 0);
    });

  let remainingSellQty = sellTx.quantity;
  let costBasis = 0;

  for (const tx of symbolTxs) {
    if (tx.type !== 'buy') continue;
    if (remainingSellQty <= 0) break;

    const consumedQty = Math.min(remainingSellQty, tx.quantity);
    const proportionalFees = (consumedQty / tx.quantity) * tx.fees;
    costBasis += consumedQty * tx.price + proportionalFees;
    remainingSellQty -= consumedQty;
  }

  const proceeds = sellTx.quantity * sellTx.price - sellTx.fees;
  return proceeds - costBasis;
}
