import { describe, it, expect } from 'vitest';
import { mergeSyncData, hasChanges, type SyncPayload } from '../sync/merge';
import type { Account, Transaction, Preference } from '../types';

function makePayload(overrides: Partial<SyncPayload> = {}): SyncPayload {
  return {
    version: 1,
    exportedAt: '2024-01-01T00:00:00.000Z',
    accounts: [],
    transactions: [],
    preferences: [],
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    name: 'Broker',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01T00:00:00.000Z',
    feeType: 'fixed',
    feeValue: 0,
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    date: '2024-01-01',
    accountId: 'a1',
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

function makePref(key: string, value: unknown): Preference {
  return { key, value };
}

describe('mergeSyncData', () => {
  it('merges accounts by id, keeping newer updatedAt', () => {
    const local = makePayload({
      accounts: [makeAccount({ id: 'a1', name: 'Old', updatedAt: '2024-01-01T00:00:00.000Z' })],
    });
    const remote = makePayload({
      accounts: [makeAccount({ id: 'a1', name: 'New', updatedAt: '2024-06-01T00:00:00.000Z' })],
    });

    const merged = mergeSyncData(local, remote);
    expect(merged.accounts).toHaveLength(1);
    expect(merged.accounts[0].name).toBe('New');
  });

  it('keeps accounts that only exist on one side', () => {
    const local = makePayload({
      accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a2', name: 'Local Only' })],
    });
    const remote = makePayload({
      accounts: [makeAccount({ id: 'a1' }), makeAccount({ id: 'a3', name: 'Remote Only' })],
    });

    const merged = mergeSyncData(local, remote);
    expect(merged.accounts).toHaveLength(3);
    expect(merged.accounts.map(a => a.id).sort()).toEqual(['a1', 'a2', 'a3']);
  });

  it('merges transactions by id, keeping newer updatedAt', () => {
    const local = makePayload({
      transactions: [makeTx({ id: 't1', price: 100, updatedAt: '2024-01-01T00:00:00.000Z' })],
    });
    const remote = makePayload({
      transactions: [makeTx({ id: 't1', price: 200, updatedAt: '2024-06-01T00:00:00.000Z' })],
    });

    const merged = mergeSyncData(local, remote);
    expect(merged.transactions).toHaveLength(1);
    expect(merged.transactions[0].price).toBe(200);
  });

  it('merges preferences with remote winning on conflict', () => {
    const local = makePayload({
      preferences: [makePref('language', 'en'), makePref('localOnly', true)],
    });
    const remote = makePayload({
      preferences: [makePref('language', 'es'), makePref('remoteOnly', true)],
    });

    const merged = mergeSyncData(local, remote);
    expect(merged.preferences).toHaveLength(3);
    const langPref = merged.preferences.find(p => p.key === 'language');
    expect(langPref?.value).toBe('es');
  });
});

describe('hasChanges', () => {
  it('returns false for identical payloads', () => {
    const payload = makePayload({
      accounts: [makeAccount()],
      transactions: [makeTx()],
    });
    expect(hasChanges(payload, payload)).toBe(false);
  });

  it('returns true when account count differs', () => {
    const local = makePayload({ accounts: [makeAccount()] });
    const merged = makePayload({ accounts: [makeAccount(), makeAccount({ id: 'a2' })] });
    expect(hasChanges(local, merged)).toBe(true);
  });

  it('returns true when account content differs', () => {
    const local = makePayload({
      accounts: [makeAccount({ name: 'A' })],
    });
    const merged = makePayload({
      accounts: [makeAccount({ name: 'B' })],
    });
    expect(hasChanges(local, merged)).toBe(true);
  });

  it('returns true when preference value differs', () => {
    const local = makePayload({
      preferences: [makePref('lang', 'en')],
    });
    const merged = makePayload({
      preferences: [makePref('lang', 'es')],
    });
    expect(hasChanges(local, merged)).toBe(true);
  });

  it('returns false for same-length payloads with same content', () => {
    const a = makePayload({
      accounts: [makeAccount()],
      transactions: [makeTx()],
      preferences: [makePref('x', 1)],
    });
    const b = makePayload({
      accounts: [makeAccount()],
      transactions: [makeTx()],
      preferences: [makePref('x', 1)],
    });
    expect(hasChanges(a, b)).toBe(false);
  });
});
