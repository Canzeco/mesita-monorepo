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
import {
  NotificationRow,
  NOTIFICATION_KINDS,
} from "@/components/consumer/notification-row";
import { ActivityRowsSkeleton } from "@/components/consumer/activity/ActivityRow";
import { EmptyState } from "@/components/shared";
import { newestNotificationAt } from "./use-unseen-notifications";

// Notifications is YOUR activity and nothing else (Pato, 2026-08-17): an
// inbox of things that happened to YOU, with no switcher.
//
// ONLY KNOWN ROWS RENDER: reservation updates and credit_ready (Pending
// credit turned Available, MESITA-3293). The list EF already returns only
// those kinds; filtering on `NOTIFICATION_KINDS` here keeps a row this
// screen cannot render off the list.

// NO BOX, NO MARGIN (Pato, 2026-11-21, MESITA-4607: "why … a box inside a
// box. just show the notification straight into there"): the rows run edge
// to edge on the page's white, a hairline between them and one under the
// last. The page draws flush (MeScreen `flush`), as Tickets does.
const FLUSH_ROWS = "border-border divide-border divide-y border-b";

// The list's bones, flush like the rows (MESITA-2701: "the placeholders
// must be similar to the page"): the shared skeleton with its box undone.
export function NotificationsSkeleton() {
  return (
    <div
      aria-hidden
      className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-t-0"
    >
      <ActivityRowsSkeleton />
    </div>
  );
}

/** The notifications themselves: the guest's events (MESITA-3688:
 *  "notifications are events"), Activity's Notifications chip (off the bar
 *  under MESITA-3697, back with MESITA-3716). Newest first under day
 *  headings (Today, Yesterday, then the date); each row is the row it always
 *  was, in the list box (MESITA-4053). */
export function NotificationsList() {
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

  // The rows are on screen: the red dot on Me goes out (MESITA-3717).
  const newest = newestNotificationAt(query.data);
  useEffect(() => {
    markNotificationsSeen(newest);
  }, [newest]);

  return (
    // A flush column (MESITA-4607); no negative margin (MESITA-3801: it
    // pulled the first child into the chip strip above).
    <div className="flex flex-col">
      {/* NO IN-BODY TITLE (Pato, 2026-09-05: "don't say here your recent
          moves. it looks NOT clean. be direct"). */}
      {/* A failed read is the centred empty state with Try again, no box
          (MESITA-4053, decision 2A, as Tickets and Wallet do). */}
      {error && !loading && visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={error}
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: query.reload }}
        />
      ) : null}

      {loading ? (
        <NotificationsSkeleton />
      ) : visible.length > 0 ? (
        <>
          {/* ONE FLAT LIST (MESITA-4000): newest first, no day headings;
              each row ends with how long ago it happened. */}
          <ul className={FLUSH_ROWS} data-activity>
            {visible.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </ul>
          {rows.length >= NOTIFICATIONS_PAGE ? (
            <p className="text-muted-foreground px-5 py-5 text-center text-xs">
              Older notifications aren&apos;t shown
            </p>
          ) : null}
        </>
      ) : error ? null : (
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

