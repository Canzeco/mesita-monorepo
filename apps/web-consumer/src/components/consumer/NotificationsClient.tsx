"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { MY_ACTIVITY } from "@/components/consumer/consumer-activity-data";
import { ConsumerActivityList } from "@/components/consumer/ConsumerActivityList";
import { NotificationRow } from "@/components/consumer/notification-row";
import { SkeletonRow } from "@/components/shared";

// Notifications is YOUR activity and nothing else (Pato, 2026-08-17).
//
// The My activity / Global activity toggle is gone. Global activity was never
// notifications — it's other people's moves, which is the Social feed's job,
// so it moved to Home > Social where it belongs. What's left needs no
// switcher: an inbox of things that happened to YOU.
export function NotificationsClient({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<ConsumerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchConsumerNotifications(supabase, userId);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(errMsg(e, "Couldn't load notifications."));
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  // Initial load: run the async fetch inline in the effect body (cancellation
  // guarded) so setState isn't called synchronously on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConsumerNotifications(supabase, userId);
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn't load notifications."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  usePayNotificationPoll(load, Boolean(userId));

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      {/* pt-4, not pt-2: Visits and Reservations both open their scroller on
          `py-4`, so an 8px top here made the content start jump by half a step
          the moment you tabbed onto Notifications. Same rhythm across all four
          sections or the row isn't one control. */}
      <header className="pt-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your recent moves
        </h2>
      </header>

      {error ? (
        <p className={cn(ERROR_BOX_CLASS, "mt-4 rounded-xl text-sm")}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex flex-col gap-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow
              key={i}
              className="border-border bg-card rounded-2xl border"
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {rows.length === 0 && MY_ACTIVITY.length === 0 && !error ? (
            <div className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-8 text-center text-sm">
              <Bell className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
              No notifications yet.
            </div>
          ) : (
            <>
              {rows.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {rows.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              ) : null}
              {MY_ACTIVITY.length > 0 ? (
                <ConsumerActivityList items={MY_ACTIVITY} />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
