"use client";

import { NOTIFICATIONS_KEY } from "@/lib/api/reservations";
import { fetchConsumerNotifications } from "@/lib/api/notifications";
import { useNotificationsSeenAt } from "@/lib/notifications-seen";
import { hasUnseen } from "@/lib/social-seen";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { NOTIFICATION_KINDS } from "./notification-row";

/** The newest notification the list can draw, or null. */
export function newestNotificationAt(
  rows: ReadonlyArray<{ kind: string; created_at: string }> | null,
): string | null {
  let newest: string | null = null;
  for (const n of rows ?? []) {
    if (!NOTIFICATION_KINDS.has(n.kind)) continue;
    if (!newest || n.created_at > newest) newest = n.created_at;
  }
  return newest;
}

/** Is there a notification this device has not shown yet (MESITA-3717)? The
 *  read is the list's own (same key), so the bar and the list share it. A
 *  failed read shows no dot. */
export function useUnseenNotifications(): boolean {
  return useUnseenNotificationCount() > 0;
}

/** How many notifications this device has not shown yet: Me's Notifications
 *  box prints it as a red count (MESITA-3885). Same read as the list's; a
 *  failed or pending read counts 0, so nothing is drawn. */
export function useUnseenNotificationCount(): number {
  const getSupabase = useLazyBrowserSupabase();
  const query = useCachedQuery(
    NOTIFICATIONS_KEY,
    () => fetchConsumerNotifications(getSupabase()),
    { ttl: 2 * 60 * 1000 },
  );
  const seenAt = useNotificationsSeenAt();
  let n = 0;
  for (const row of query.data ?? []) {
    if (!NOTIFICATION_KINDS.has(row.kind)) continue;
    if (hasUnseen(row.created_at, seenAt)) n += 1;
  }
  return n;
}
