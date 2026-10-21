"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { SAVED_TAB_HREF } from "@/lib/consumer-route-contract";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import {
  NotificationRow,
  RESERVATION_KINDS,
} from "@/components/consumer/notification-row";
import { EmptyState, SkeletonRow } from "@/components/shared";

// Notifications is YOUR activity and nothing else (Pato, 2026-08-17): an
// inbox of things that happened to YOU, with no switcher.
//
// ONLY RESERVATION ROWS RENDER. The list EF already returns only the kinds a
// booking writes; filtering on `RESERVATION_KINDS` here keeps a row this
// screen cannot render off the list.
export function NotificationsClient() {
  const supabase = useBrowserSupabase();
  const [rows, setRows] = useState<ConsumerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run the async fetch inline in the effect body (cancellation guarded) so
  // setState isn't called synchronously on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConsumerNotifications(supabase);
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
  }, [supabase]);

  const visible = rows.filter((n) => RESERVATION_KINDS.has(n.kind));

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      {/* NO IN-BODY TITLE (Pato, 2026-09-05: "don't say here your recent
          moves. it looks NOT clean. be direct"). The page header already
          names this list; a heading that repeats the tile you just tapped is
          furniture. Every branch below opens on `mt-4`, the same step
          Reservations gets from its `py-4` scroller. */}
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
      ) : visible.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {visible.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </div>
      ) : error ? null : (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          action={{
            label: "See your reservations",
            href: SAVED_TAB_HREF.reservations,
          }}
        />
      )}
    </div>
  );
}
