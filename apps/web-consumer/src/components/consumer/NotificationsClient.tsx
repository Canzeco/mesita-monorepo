"use client";

import { Bell } from "lucide-react";
import { NOTIFICATIONS_KEY } from "@/lib/api/reservations";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  NotificationRow,
  NotificationRowSkeleton,
  RESERVATION_KINDS,
} from "@/components/consumer/notification-row";
import { EmptyState } from "@/components/shared";

// Notifications is YOUR activity and nothing else (Pato, 2026-08-17): an
// inbox of things that happened to YOU, with no switcher.
//
// ONLY RESERVATION ROWS RENDER. The list EF already returns only the kinds a
// booking writes; filtering on `RESERVATION_KINDS` here keeps a row this
// screen cannot render off the list.

const FEED_CLASS =
  "scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6";

/** The rows' column: 20px under the header, 8px apart. */
const LIST_CLASS = "mt-5 flex flex-col gap-2";

// Four NotificationRow silhouettes (notification-row.tsx, beside the row
// they stand in for) on the list's own step (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the sizes").
function SkeletonRows() {
  return (
    <div className={LIST_CLASS} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <NotificationRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** The feed while it loads: what /me/notifications/loading.tsx draws under
 *  the page's frame, and what this component draws until the fetch lands. */
export function NotificationsSkeleton() {
  return (
    <div className={FEED_CLASS}>
      <SkeletonRows />
    </div>
  );
}

export function NotificationsClient() {
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

  const visible = rows.filter((n) => RESERVATION_KINDS.has(n.kind));

  return (
    <div className={FEED_CLASS}>
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
        <SkeletonRows />
      ) : visible.length > 0 ? (
        <div className={LIST_CLASS}>
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
            href: CONSUMER_ROUTES.mePages.reservations,
          }}
        />
      )}
    </div>
  );
}
