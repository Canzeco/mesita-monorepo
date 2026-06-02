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
    // Use a unique topic per mount to avoid callback registration races when
    // React remounts effects quickly (StrictMode / fast refresh).
    const channelTopic = `pending-notifications:${userId}:${crypto.randomUUID()}`;
    let channel:
      | ReturnType<ReturnType<typeof useBrowserSupabase>["channel"]>
      | undefined;
    try {
      channel = supabase
        .channel(channelTopic)
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
    } catch (err) {
      // Realtime should enhance this badge, never take the page down.
      console.error("[usePendingNotificationCount] realtime subscribe:", err);
    }
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  return pending;
}
