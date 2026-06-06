import { describe, it, expect } from 'vitest';
import { recalculateAllRealizedPnl } from '../utils/realizedPnlBatch';
import type { Transaction } from '../types';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    date: '2024-01-01',
    accountId: 'acc1',
    symbol: 'TEST',
    assetClass: 'arg_stocks',
    type: 'buy',
    quantity: 10,
    price: 100,
    fees: 0,
    currency: 'ARS',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('recalculateAllRealizedPnl', () => {
  it('returns empty pnls for buy-only transactions', () => {
    const txs = [makeTx({ id: 'b1', type: 'buy', quantity: 10, price: 100 })];
    const { pnls, diagnostics } = recalculateAllRealizedPnl(txs);
    expect(pnls.size).toBe(0);
    expect(diagnostics).toHaveLength(0);
  });

  it('computes simple FIFO PnL for one buy + one sell', () => {
    const buy = makeTx({ id: 'b1', type: 'buy', quantity: 10, price: 100, fees: 5 });
    const sell = makeTx({ id: 's1', type: 'sell', quantity: 10, price: 120, fees: 3, date: '2024-02-01' });
    const { pnls } = recalculateAllRealizedPnl([buy, sell]);

    const proceeds = 10 * 120 - 3;
    const costBasis = 10 * 100 + 5;
    expect(pnls.get('s1')).toBeCloseTo(proceeds - costBasis, 6);
  });

  it('handles partial sell from multiple buy lots', () => {
    const buy1 = makeTx({ id: 'b1', type: 'buy', quantity: 5, price: 100, fees: 0, date: '2024-01-01' });
    const buy2 = makeTx({ id: 'b2', type: 'buy', quantity: 5, price: 110, fees: 0, date: '2024-01-15' });
    const sell = makeTx({ id: 's1', type: 'sell', quantity: 7, price: 120, fees: 0, date: '2024-02-01' });

    const { pnls } = recalculateAllRealizedPnl([buy1, buy2, sell]);

    const costBasis = 5 * 100 + 2 * 110;
    const proceeds = 7 * 120;
    expect(pnls.get('s1')).toBeCloseTo(proceeds - costBasis, 6);
  });

  it('reports diagnostics for oversell', () => {
    const buy = makeTx({ id: 'b1', type: 'buy', quantity: 5, price: 100 });
    const sell = makeTx({ id: 's1', type: 'sell', quantity: 10, price: 120, date: '2024-02-01' });

    const { diagnostics } = recalculateAllRealizedPnl([buy, sell]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].unmatchedQty).toBe(5);
    expect(diagnostics[0].symbol).toBe('TEST');
  });

  it('handles multiple sells consuming same buy lots', () => {
    const buy = makeTx({ id: 'b1', type: 'buy', quantity: 10, price: 100, fees: 0 });
    const sell1 = makeTx({ id: 's1', type: 'sell', quantity: 4, price: 110, fees: 0, date: '2024-02-01' });
    const sell2 = makeTx({ id: 's2', type: 'sell', quantity: 4, price: 120, fees: 0, date: '2024-03-01' });

    const { pnls } = recalculateAllRealizedPnl([buy, sell1, sell2]);

    expect(pnls.get('s1')).toBeCloseTo(4 * 110 - 4 * 100, 6);
    expect(pnls.get('s2')).toBeCloseTo(4 * 120 - 4 * 100, 6);
  });

  it('tracks separate symbols independently', () => {
    const buyA = makeTx({ id: 'ba', symbol: 'A', type: 'buy', quantity: 10, price: 50 });
    const buyB = makeTx({ id: 'bb', symbol: 'B', type: 'buy', quantity: 10, price: 200 });
    const sellA = makeTx({ id: 'sa', symbol: 'A', type: 'sell', quantity: 5, price: 60, date: '2024-02-01' });
    const sellB = makeTx({ id: 'sb', symbol: 'B', type: 'sell', quantity: 5, price: 210, date: '2024-02-01' });

    const { pnls } = recalculateAllRealizedPnl([buyA, buyB, sellA, sellB]);

    expect(pnls.get('sa')).toBeCloseTo(5 * 60 - 5 * 50, 6);
    expect(pnls.get('sb')).toBeCloseTo(5 * 210 - 5 * 200, 6);
  });

  it('includes proportional fees in cost basis', () => {
    const buy = makeTx({ id: 'b1', type: 'buy', quantity: 10, price: 100, fees: 20 });
    const sell = makeTx({ id: 's1', type: 'sell', quantity: 5, price: 120, fees: 10, date: '2024-02-01' });

    const { pnls } = recalculateAllRealizedPnl([buy, sell]);

    const proportionalBuyFees = (5 / 10) * 20;
    const costBasis = 5 * 100 + proportionalBuyFees;
    const proceeds = 5 * 120 - 10;
    expect(pnls.get('s1')).toBeCloseTo(proceeds - costBasis, 6);
  });
});
