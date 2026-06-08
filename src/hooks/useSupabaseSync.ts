import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { flushQueue, initialSync, initialSyncExtended, subscribeToChanges } from '../sync/supabaseSync';

export function useSupabaseSync() {
  const { user } = useAuth();
  const isSyncing = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const sync = useCallback(async () => {
    if (isSyncing.current || !user) return;
    isSyncing.current = true;

    try {
      await flushQueue();
    } catch (err) {
      console.error('[sync] Flush failed:', err);
    } finally {
      isSyncing.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    initialSync().catch((err) => {
      console.error('[sync] Initial sync failed:', err);
    });
    initialSyncExtended().catch((err) => {
      console.error('[sync] Extended sync failed:', err);
    });

    unsubscribeRef.current = subscribeToChanges(() => {
      initialSync().catch((err) => console.error('[sync] Realtime sync failed:', err));
      initialSyncExtended().catch((err) => console.error('[sync] Realtime extended sync failed:', err));
    });

    const handleOnline = () => {
      sync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
    };
  }, [user, sync]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      sync();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, sync]);

  return { sync };
}
