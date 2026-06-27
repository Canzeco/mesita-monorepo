"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MapPin, Star } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { formatPayMx } from "@/lib/api/pay";
import { errMsg } from "@/lib/utils";
import { payTabHref } from "@/lib/pay-route";
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from "@/components/consumer/consumer-activity-data";
import {
  ConsumerActivityList,
  InboxSegmentTabs,
} from "@/components/consumer/ConsumerActivityList";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export type InboxTab = "mine" | "global";

function kindLabel(kind: string): string {
  if (kind === "bill") return "Your bill";
  if (kind === "review") return "Review update";
  return "Update";
}

function kindIcon(kind: string) {
  if (kind === "review") return Star;
  return Bell;
}

function NotificationRow({ n }: { n: ConsumerNotification }) {
  const Icon = kindIcon(n.kind);
  const p = n.bill;
  const reward =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  return (
    <article className="border-border bg-card flex gap-3 overflow-hidden rounded-2xl border p-3">
      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {p.place_photo_url ? (
          <Image
            src={p.place_photo_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <MapPin className="h-5 w-5 opacity-40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-sm leading-snug font-semibold">
            {p.place_name ?? "Mesita partner"}
          </p>
        </div>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12px]">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {kindLabel(n.kind)}
        </p>
        {reward > 0 ? (
          <p className="text-secondary mt-1 text-[12px] font-medium">
            Reward {formatPayMx(reward, p.currency)}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-1 text-[10px]">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </article>
  );
}

export function NotificationsClient({
  userId,
  initialTab,
}: {
  userId: string;
  initialTab: InboxTab;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [tab, setTab] = useState<InboxTab>(initialTab);
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

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`notifications-page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consumer_pay_notifications",
          filter: `consumer_id=eq.${userId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

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
        <p className="bg-destructive/10 text-destructive mt-4 rounded-xl px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {tab === "global" ? (
        <div className="mt-4 flex flex-col gap-3">
          <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
        </div>
      ) : loading ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">
          Loading…
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {rows.length === 0 && MY_ACTIVITY.length === 0 ? (
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
