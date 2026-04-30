import { useState, useEffect, useCallback } from 'react';
import type { Account } from '../types';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '../db';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getAccounts();
    setAccounts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (name: string, feeType: 'fixed' | 'percentage' = 'fixed', feeValue: number = 0) => {
    const id = await addAccount({ name, createdAt: new Date().toISOString().split('T')[0], feeType, feeValue });
    await refresh();
    return id;
  }, [refresh]);

  const update = useCallback(async (id: number, changes: Partial<Account>) => {
    await updateAccount(id, changes);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await deleteAccount(id);
    await refresh();
  }, [refresh]);

  return { accounts, loading, create, update, remove, refresh };
}
