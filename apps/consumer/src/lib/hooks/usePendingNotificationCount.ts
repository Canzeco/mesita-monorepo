"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fetchPendingNotificationCount } from "@/lib/api/notifications";

export function usePendingNotificationCount(userId: string | undefined) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPending(0);
      return;
    }
    const n = await fetchPendingNotificationCount(supabase, userId);
    setPending(n);
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
    if (!userId) return;
    const channel = supabase
      .channel(`pending-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consumer_pay_notifications",
          filter: `consumer_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  return pending;
}
