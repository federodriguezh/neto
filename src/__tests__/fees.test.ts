import { describe, it, expect } from 'vitest';
import { calculateFees } from '../utils/fees';
import type { Account } from '../types';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'test',
    name: 'Test',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    feeType: 'fixed',
    feeValue: 0,
    ...overrides,
  };
}

describe('calculateFees', () => {
  describe('arg_stocks', () => {
    it('fixed fee: commission + market fee + IVA', () => {
      const account = makeAccount({ feeType: 'fixed', feeValue: 100 });
      const fees = calculateFees(
        { quantity: 10, price: 1000, assetClass: 'arg_stocks' },
        account
      );
      const base = 10 * 1000;
      const commission = 100;
      const marketFee = base * 0.0005;
      const iva = (commission + marketFee) * 0.21;
      expect(fees).toBeCloseTo(commission + marketFee + iva, 6);
    });

    it('percentage fee: commission + market fee + IVA', () => {
      const account = makeAccount({ feeType: 'percentage', feeValue: 0.5 });
      const fees = calculateFees(
        { quantity: 10, price: 1000, assetClass: 'arg_stocks' },
        account
      );
      const base = 10 * 1000;
      const commission = base * 0.005;
      const marketFee = base * 0.0005;
      const iva = (commission + marketFee) * 0.21;
      expect(fees).toBeCloseTo(commission + marketFee + iva, 6);
    });
  });

  describe('arg_cedears', () => {
    it('same formula as arg_stocks', () => {
      const account = makeAccount({ feeType: 'fixed', feeValue: 50 });
      const fees = calculateFees(
        { quantity: 5, price: 2000, assetClass: 'arg_cedears' },
        account
      );
      const base = 5 * 2000;
      const commission = 50;
      const marketFee = base * 0.0005;
      const iva = (commission + marketFee) * 0.21;
      expect(fees).toBeCloseTo(commission + marketFee + iva, 6);
    });
  });

  describe('arg_bonds', () => {
    it('fixed fee: commission + market fee, no IVA', () => {
      const account = makeAccount({ feeType: 'fixed', feeValue: 25 });
      const fees = calculateFees(
        { quantity: 100, price: 50, assetClass: 'arg_bonds' },
        account
      );
      const base = 100 * 50;
      const commission = 25;
      const marketFee = base * 0.0001;
      expect(fees).toBeCloseTo(commission + marketFee, 6);
    });
  });

  describe('zero fee account', () => {
    it('only market fee + IVA for stocks', () => {
      const account = makeAccount({ feeType: 'fixed', feeValue: 0 });
      const fees = calculateFees(
        { quantity: 10, price: 1000, assetClass: 'arg_stocks' },
        account
      );
      const base = 10 * 1000;
      const marketFee = base * 0.0005;
      const iva = marketFee * 0.21;
      expect(fees).toBeCloseTo(marketFee + iva, 6);
    });
  });
});
