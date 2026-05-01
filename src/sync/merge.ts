import type { Account, Transaction, Preference } from '../types';

export interface SyncPayload {
  accounts: Account[];
  transactions: Transaction[];
  preferences: Preference[];
  version: number;
  exportedAt: string;
}

function mergeAccounts(local: Account[], remote: Account[]): Account[] {
  const map = new Map<string, Account>();
  for (const a of local) map.set(a.id, a);
  for (const a of remote) {
    const existing = map.get(a.id);
    if (!existing || a.updatedAt > existing.updatedAt) {
      map.set(a.id, a);
    }
  }
  return Array.from(map.values());
}

function mergeTransactions(local: Transaction[], remote: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) {
    const existing = map.get(t.id);
    if (!existing || t.updatedAt > existing.updatedAt) {
      map.set(t.id, t);
    }
  }
  return Array.from(map.values());
}

function mergePreferences(local: Preference[], remote: Preference[]): Preference[] {
  const map = new Map<string, Preference>();
  for (const p of local) map.set(p.key, p);
  for (const p of remote) {
    map.set(p.key, p);
  }
  return Array.from(map.values());
}

export function mergeSyncData(local: SyncPayload, remote: SyncPayload): SyncPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: mergeAccounts(local.accounts, remote.accounts),
    transactions: mergeTransactions(local.transactions, remote.transactions),
    preferences: mergePreferences(local.preferences, remote.preferences),
  };
}

export function hasChanges(local: SyncPayload, merged: SyncPayload): boolean {
  if (local.accounts.length !== merged.accounts.length) return true;
  if (local.transactions.length !== merged.transactions.length) return true;
  if (local.preferences.length !== merged.preferences.length) return true;

  const localAccountIds = new Set(local.accounts.map((a) => a.id));
  for (const a of merged.accounts) {
    if (!localAccountIds.has(a.id)) return true;
    const localA = local.accounts.find((la) => la.id === a.id);
    if (localA && JSON.stringify(localA) !== JSON.stringify(a)) return true;
  }

  const localTxIds = new Set(local.transactions.map((t) => t.id));
  for (const t of merged.transactions) {
    if (!localTxIds.has(t.id)) return true;
    const localT = local.transactions.find((lt) => lt.id === t.id);
    if (localT && JSON.stringify(localT) !== JSON.stringify(t)) return true;
  }

  const localPrefKeys = new Set(local.preferences.map((p) => p.key));
  for (const p of merged.preferences) {
    if (!localPrefKeys.has(p.key)) return true;
    const localP = local.preferences.find((lp) => lp.key === p.key);
    if (localP && JSON.stringify(localP.value) !== JSON.stringify(p.value)) return true;
  }

  return false;
}
