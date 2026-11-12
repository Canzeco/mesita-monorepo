"use client";

import { useEffect } from "react";
import { Bell } from "lucide-react";
import { NOTIFICATIONS_KEY } from "@/lib/api/reservations";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { markNotificationsSeen } from "@/lib/notifications-seen";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  NotificationRow,
  NOTIFICATION_KINDS,
} from "@/components/consumer/notification-row";
import {
  ActivityRows,
  ActivityRowsSkeleton,
} from "@/components/consumer/activity/ActivityRow";
import { EmptyState } from "@/components/shared";
import { newestNotificationAt } from "./use-unseen-notifications";

// Notifications is YOUR activity and nothing else (Pato, 2026-08-17): an
// inbox of things that happened to YOU, with no switcher.
//
// ONLY KNOWN ROWS RENDER: reservation updates and credit_ready (Pending
// credit turned Available, MESITA-3293). The list EF already returns only
// those kinds; filtering on `NOTIFICATION_KINDS` here keeps a row this
// screen cannot render off the list.

// The list's bones: one card of rows, as Activity's other chips draw
// (MESITA-3778; MESITA-2701: "the placeholders must be similar to the page").
function SkeletonRows() {
  return (
    <div className="mt-5" aria-hidden>
      <ActivityRowsSkeleton />
    </div>
  );
}

/** The notifications themselves: the guest's events (MESITA-3688:
 *  "notifications are events"), Activity's Notifications chip (off the bar
 *  under MESITA-3697, back with MESITA-3716). Newest first under day
 *  headings (Today, Yesterday, then the date); each row is the row it always
 *  was. `quietEmpty`: a "Next up" ticket stands above, so an empty list is
 *  one muted line, not a second empty state. */
export function NotificationsList({
  quietEmpty = false,
}: {
  quietEmpty?: boolean;
}) {
  // Kept for two minutes and refreshed by every reservation write
  // (MESITA-3014): a return to this list paints its rows, not skeletons.
  const getSupabase = useLazyBrowserSupabase();
  const query = useCachedQuery(
    NOTIFICATIONS_KEY,
    () => fetchConsumerNotifications(getSupabase()),
    { ttl: 2 * 60 * 1000 },
  );
  const rows: ConsumerNotification[] = query.data ?? [];
  const loading = query.loading;
  const error = query.error ? "Couldn't load notifications." : null;

  const visible = rows.filter((n) => NOTIFICATION_KINDS.has(n.kind));
  const days = byDay(visible);

  // The rows are on screen: the red dot on Me goes out (MESITA-3717).
  const newest = newestNotificationAt(query.data);
  useEffect(() => {
    markNotificationsSeen(newest);
  }, [newest]);

  return (
    <div className="-mt-5">
      {/* NO IN-BODY TITLE (Pato, 2026-09-05: "don't say here your recent
          moves. it looks NOT clean. be direct"). */}
      {error ? (
        <p className={cn(ERROR_BOX_CLASS, "mt-4 rounded-xl text-sm")}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <SkeletonRows />
      ) : visible.length > 0 ? (
        <>
          {days.map(([day, list]) => (
            <section key={day} className="mt-5">
              <h2 className="text-muted-foreground type-eyebrow">{day}</h2>
              <div className="mt-2">
                <ActivityRows>
                  {list.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </ActivityRows>
              </div>
            </section>
          ))}
          {rows.length >= NOTIFICATIONS_PAGE ? (
            <p className="text-muted-foreground mt-5 text-center text-xs">
              Older notifications aren&apos;t shown
            </p>
          ) : null}
        </>
      ) : error ? null : quietEmpty ? (
        <p className="text-muted-foreground mt-5 text-sm">Nothing new yet.</p>
      ) : (
        <EmptyState
          icon={Bell}
          title="Nothing new yet"
          action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
        />
      )}
    </div>
  );
}

/** How many rows one read brings (fetchConsumerNotifications' default). */
const NOTIFICATIONS_PAGE = 40;

/** Rows grouped under their day, newest first: "Today", "Yesterday", then
 *  "Mon Nov 9", in the device's time zone. */
function byDay(
  rows: ConsumerNotification[],
): Array<[string, ConsumerNotification[]]> {
  const out: Array<[string, ConsumerNotification[]]> = [];
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  for (const n of rows) {
    const d = new Date(n.created_at);
    const day = same(d, today)
      ? "Today"
      : same(d, yesterday)
        ? "Yesterday"
        : d
            .toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
            .replace(",", "");
    const last = out[out.length - 1];
    if (last && last[0] === day) last[1].push(n);
    else out.push([day, [n]]);
  }
  return out;
}
