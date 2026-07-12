import { useCallback, useEffect, useState } from 'react';

import { fetchPendingNotificationCount } from '@/lib/api/notifications';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';

export function usePendingNotificationCount(userId: string | undefined) {
  const [pending, setPending] = useState(0);

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    if (!userId) setPending(0);
  }

  const refresh = useCallback(async () => {
    if (!userId) {
      setPending(0);
      return;
    }
    try {
      const n = await fetchPendingNotificationCount(userId);
      setPending(n);
    } catch {
      // Failed poll tick: keep last known count.
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await fetchPendingNotificationCount(userId);
        if (!cancelled) setPending(n);
      } catch {
        // Keep last known count.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  usePayNotificationPoll(refresh, Boolean(userId));

  return pending;
}
