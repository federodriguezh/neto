import type { Transaction, Account } from '../types';

export function calculateFees(tx: Pick<Transaction, 'quantity' | 'price' | 'assetClass'>, account: Account): number {
  const base = tx.quantity * tx.price;

  let commission = 0;
  if (account.feeType === 'fixed') {
    commission = account.feeValue;
  } else {
    commission = base * (account.feeValue / 100);
  }

  if (tx.assetClass === 'arg_stocks' || tx.assetClass === 'arg_cedears') {
    const marketFee = base * 0.0005;
    const iva = (commission + marketFee) * 0.21;
    return commission + marketFee + iva;
  }

  if (tx.assetClass === 'arg_bonds') {
    const marketFee = base * 0.0001;
    return commission + marketFee;
  }

  return commission;
}
