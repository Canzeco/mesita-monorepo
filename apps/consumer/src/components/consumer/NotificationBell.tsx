"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { fetchPendingNotificationCount } from "@/lib/api/notifications";

export function NotificationBell({ userId }: { userId: string }) {
  const supabase = useBrowserSupabase();
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    const n = await fetchPendingNotificationCount(supabase, userId);
    setPending(n);
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`notification-bell:${userId}`)
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
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  return (
    <Link
      href="/notifications"
      aria-label={
        pending > 0
          ? `Notifications, ${pending} pending`
          : "Notifications"
      }
      className={cn(
        "border-border bg-card shadow-glow relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition hover:opacity-90 active:scale-[0.98]",
        pending > 0 && "border-secondary/40",
      )}
    >
      <Bell className="text-foreground h-5 w-5" strokeWidth={2} />
      {pending > 0 ? (
        <span className="bg-secondary text-background absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold">
          {pending > 9 ? "9+" : pending}
        </span>
      ) : null}
    </Link>
  );
}
