"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronRight, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from "@/lib/api/notifications";
import { formatPayMx } from "@/lib/api/pay";
import { errMsg } from "@/lib/utils";

function kindLabel(kind: string): string {
  if (kind === "payment_confirm") return "Confirm payment";
  if (kind === "review") return "Rate your visit";
  return "Update";
}

function kindIcon(kind: string) {
  if (kind === "review") return Star;
  return Bell;
}

function NotificationRow({ n }: { n: ConsumerNotification }) {
  const Icon = kindIcon(n.kind);
  const pending = n.status === "pending";
  const p = n.bill;
  const reward =
    p.total_reward_cents ??
    (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  return (
    <Link
      href="/pay"
      className={cn(
        "border-border bg-card flex gap-3 overflow-hidden rounded-2xl border p-3 transition active:scale-[0.99]",
        pending && "border-secondary/35 bg-secondary/5",
      )}
    >
      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {p.venue_photo_url ? (
          <Image
            src={p.venue_photo_url}
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
          <p className="text-foreground text-sm font-semibold leading-snug">
            {p.venue_name ?? "Mesita partner"}
          </p>
          {pending ? (
            <span className="bg-secondary text-background shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
              New
            </span>
          ) : null}
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
      <ChevronRight className="text-muted-foreground mt-1 h-5 w-5 shrink-0" />
    </Link>
  );
}

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

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      <p className="text-muted-foreground pt-2 text-sm">
        Payment requests and reviews from your visits. Open a ticket in{" "}
        <Link href="/pay" className="text-secondary font-medium underline-offset-2 hover:underline">
          Pay
        </Link>
        .
      </p>

      {error ? (
        <p className="bg-destructive/10 text-destructive mt-4 rounded-xl px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground mt-6 rounded-2xl border px-4 py-10 text-center text-sm">
          <Bell className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
          No notifications yet. When a restaurant opens a ticket for you,
          it will show up here and in Pay → Tickets.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {pending.length > 0 ? (
            <section>
              <h2 className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wider uppercase">
                Action needed
              </h2>
              <div className="flex flex-col gap-2">
                {pending.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            </section>
          ) : null}
          {done.length > 0 ? (
            <section>
              <h2 className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wider uppercase">
                Earlier
              </h2>
              <div className="flex flex-col gap-2">
                {done.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
