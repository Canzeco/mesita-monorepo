"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fetchPendingNotificationCount } from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";

export function usePendingNotificationCount(userId: string | undefined) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState(0);

  // When there's no signed-in user the count is zero. Reset during render
  // (prop-change pattern) rather than in an effect so no synchronous setState
  // fires from useEffect.
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
      const n = await fetchPendingNotificationCount(supabase, userId);
      setPending(n);
    } catch {
      // Failed poll tick (offline, EF hiccup): keep the last known count
      // instead of surfacing an unhandled rejection every 15s.
    }
  }, [supabase, userId]);

  // Initial fetch: run the async work inline in the effect body (with a
  // cancellation guard) so setState isn't called synchronously on mount.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await fetchPendingNotificationCount(supabase, userId);
        if (!cancelled) setPending(n);
      } catch {
        // Keep last known count; see refresh().
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  usePayNotificationPoll(refresh, Boolean(userId));

  return pending;
}
