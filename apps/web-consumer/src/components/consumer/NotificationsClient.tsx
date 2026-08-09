"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { usePayNotificationPoll } from "@/lib/hooks/usePayNotificationPoll";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from "@/components/consumer/consumer-activity-data";
import {
  ConsumerActivityList,
  InboxSegmentTabs,
} from "@/components/consumer/ConsumerActivityList";
import { NotificationRow } from "@/components/consumer/notification-row";
import { SkeletonRow } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export type InboxTab = "mine" | "global";

export function NotificationsClient({
  userId,
  initialTab,
}: {
  userId: string;
  initialTab: InboxTab;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  // `tab` is optimistic: onTabChange flips it immediately, then router.push
  // re-renders with the route-derived `initialTab`. Rather than sync the prop
  // into state via an effect (cascading render), adjust state during render
  // when the incoming prop changes — React's recommended pattern.
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState<InboxTab>(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }
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

  const myCount = rows.length + MY_ACTIVITY.length;
  const globalCount = GLOBAL_ACTIVITY.length;

  const onTabChange = (next: InboxTab) => {
    setTab(next);
    router.push(
      next === "mine"
        ? CONSUMER_ROUTES.inbox.mine
        : CONSUMER_ROUTES.inbox.global,
      { scroll: false },
    );
  };

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      <header className="pt-2">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Inbox
        </p>
        <h2 className="font-display mt-0.5 text-lg font-semibold tracking-tight">
          {tab === "mine" ? "Your recent moves" : "What's happening on Mesita"}
        </h2>
      </header>

      <div className="mt-3">
        <InboxSegmentTabs
          active={tab}
          onChange={onTabChange}
          myCount={myCount}
          globalCount={globalCount}
        />
      </div>

      {error ? (
        <p className={cn(ERROR_BOX_CLASS, "mt-4 rounded-xl text-sm")}>
          {error}
        </p>
      ) : null}

      {tab === "global" ? (
        <div className="mt-4 flex flex-col gap-3">
          <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
        </div>
      ) : loading ? (
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
