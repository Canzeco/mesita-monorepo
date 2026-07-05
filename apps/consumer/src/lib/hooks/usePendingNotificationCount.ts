"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fetchPendingNotificationCount } from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";

export function usePendingNotificationCount(userId: string | undefined) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState(0);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePayNotificationPoll(refresh, Boolean(userId));

  return pending;
}
