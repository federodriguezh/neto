import { useState, useEffect, useCallback, useRef } from 'react';
import { db, getPreference, setPreference, clearPortfolioHistory, clearPriceCache } from '../db';
import { encrypt, decrypt } from '../sync/crypto';
import { createGist, fetchGist, updateGist, findNetoGist, SyncError } from '../sync/github';
import { mergeSyncData, hasChanges, type SyncPayload } from '../sync/merge';

const SYNC_INTERVAL_MS = 3_600_000; // 1 hour
const SYNC_PREF_KEYS = new Set(['syncPat', 'syncGistId', 'syncEnabled', 'syncLastAt']);

interface SyncState {
  enabled: boolean;
  pat: string;
  passphrase: string;
  gistId: string | null;
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'error' | 'success';
  error: string | null;
}

function loadPassphrase(): string {
  localStorage.removeItem('neto-sync-passphrase');
  return '';
}

function savePassphrase(value: string): void {
  void value;
  localStorage.removeItem('neto-sync-passphrase');
}

async function loadSyncPrefs(): Promise<Pick<SyncState, 'enabled' | 'gistId' | 'lastSyncAt'>> {
  const [enabledPref, gistPref, lastPref] = await Promise.all([
    getPreference('syncEnabled'),
    getPreference('syncGistId'),
    getPreference('syncLastAt'),
  ]);
  return {
    enabled: enabledPref?.value === true,
    gistId: (gistPref?.value as string) ?? null,
    lastSyncAt: (lastPref?.value as string) ?? null,
  };
}

async function saveSyncPrefs(state: Pick<SyncState, 'enabled' | 'gistId' | 'lastSyncAt'>): Promise<void> {
  await Promise.all([
    setPreference('syncEnabled', state.enabled),
    setPreference('syncGistId', state.gistId),
    setPreference('syncLastAt', state.lastSyncAt),
  ]);
}

async function buildLocalPayload(): Promise<SyncPayload> {
  const [accounts, transactions, preferences] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.preferences.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
    transactions,
    preferences: preferences.filter((p) => !SYNC_PREF_KEYS.has(p.key)),
  };
}

async function writeMergedData(merged: SyncPayload): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.preferences], async () => {
    await Promise.all([
      db.accounts.clear().then(() => db.accounts.bulkPut(merged.accounts)),
      db.transactions.clear().then(() => db.transactions.bulkPut(merged.transactions)),
    ]);
    // Merge preferences without touching sync prefs
    const existingPrefs = await db.preferences.toArray();
    const syncPrefs = existingPrefs.filter((p) => SYNC_PREF_KEYS.has(p.key));
    await db.preferences.clear();
    await db.preferences.bulkPut([...merged.preferences, ...syncPrefs]);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSyncPayload(value: unknown): value is SyncPayload {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.preferences)
  );
}

export function useSync() {
  const [state, setState] = useState<SyncState>({
    enabled: false,
    pat: '',
    passphrase: loadPassphrase(),
    gistId: null,
    lastSyncAt: null,
    status: 'idle',
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load persisted sync prefs on mount
  useEffect(() => {
    loadSyncPrefs().then((prefs) => {
      setState((s) => ({ ...s, ...prefs }));
    });
  }, []);

  // Manage auto-sync interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (state.enabled && state.pat && state.passphrase && state.gistId) {
      intervalRef.current = setInterval(() => {
        void syncNow();
      }, SYNC_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.enabled, state.pat, state.passphrase, state.gistId]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    stateRef.current = { ...stateRef.current, enabled, status: 'idle', error: null };
    setState((s) => ({ ...s, enabled, status: 'idle', error: null }));
    await setPreference('syncEnabled', enabled);
  }, []);

  const setPat = useCallback(async (pat: string) => {
    stateRef.current = { ...stateRef.current, pat };
    setState((s) => ({ ...s, pat }));
  }, []);

  const setPassphrase = useCallback((passphrase: string) => {
    savePassphrase(passphrase);
    stateRef.current = { ...stateRef.current, passphrase };
    setState((s) => ({ ...s, passphrase }));
  }, []);

  const setGistId = useCallback(async (gistId: string | null) => {
    stateRef.current = { ...stateRef.current, gistId };
    setState((s) => ({ ...s, gistId }));
    await setPreference('syncGistId', gistId);
  }, []);

  const syncNow = useCallback(async () => {
    const { enabled, pat, passphrase, gistId } = stateRef.current;
    if (!enabled || !pat || !passphrase) {
      setState((s) => ({ ...s, status: 'idle', error: null }));
      return;
    }

    setState((s) => ({ ...s, status: 'syncing', error: null }));

    try {
      let currentGistId = gistId;

      // Find or create gist
      if (!currentGistId) {
        currentGistId = await findNetoGist(pat);
        if (!currentGistId) {
          const local = await buildLocalPayload();
          const encrypted = await encrypt(JSON.stringify(local), passphrase);
          currentGistId = await createGist(encrypted, pat);
          await setGistId(currentGistId);
          await saveSyncPrefs({ enabled, gistId: currentGistId, lastSyncAt: new Date().toISOString() });
          setState((s) => ({ ...s, gistId: currentGistId, status: 'success', lastSyncAt: new Date().toISOString() }));
          return;
        }
        await setGistId(currentGistId);
      }

      // Fetch remote
      const remoteGist = await fetchGist(currentGistId, pat);
      const parsedRemote: unknown = JSON.parse(await decrypt(remoteGist.content, passphrase));
      if (!isSyncPayload(parsedRemote)) {
        throw new SyncError('Invalid sync payload');
      }
      const remotePayload = parsedRemote;

      // Build local payload
      const localPayload = await buildLocalPayload();

      // Merge
      const merged = mergeSyncData(localPayload, remotePayload);

      // Determine what changed
      const localChanged = hasChanges(localPayload, merged);
      const remoteChanged = hasChanges(remotePayload, merged);

      // Push if remote is stale
      if (remoteChanged) {
        const encrypted = await encrypt(JSON.stringify(merged), passphrase);
        await updateGist(currentGistId, encrypted, pat);
      }

      // Pull if local is stale
      if (localChanged) {
        await writeMergedData(merged);
        await clearPortfolioHistory();
        await clearPriceCache();
        window.location.reload();
        return;
      }

      const now = new Date().toISOString();
      await saveSyncPrefs({ enabled, gistId: currentGistId, lastSyncAt: now });
      setState((s) => ({ ...s, status: 'success', lastSyncAt: now, error: null }));
    } catch (err) {
      const message = err instanceof SyncError ? err.message : err instanceof Error ? err.message : 'Sync failed';
      setState((s) => ({ ...s, status: 'error', error: message }));
    }
  }, [setGistId]);

  const unlink = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    savePassphrase('');
    await Promise.all([
      setPreference('syncEnabled', false),
      setPreference('syncPat', ''),
      setPreference('syncGistId', null),
      setPreference('syncLastAt', null),
    ]);
    setState({
      enabled: false,
      pat: '',
      passphrase: '',
      gistId: null,
      lastSyncAt: null,
      status: 'idle',
      error: null,
    });
  }, []);

  return {
    ...state,
    setEnabled,
    setPat,
    setPassphrase,
    syncNow,
    unlink,
  };
}
