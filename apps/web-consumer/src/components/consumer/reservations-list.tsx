"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ReservationCard } from "@/components/consumer/ReservationCard";
import { LoadingFill } from "@/components/shared";
import { apiListReservations } from "@/lib/api/reservations";
import type { ReservationItem } from "@/lib/mock/reservations-mock";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";

// Live reservations list: Me › Reservations. Reads
// consumer-web-list-reservations at scope "all" and renders ReservationCard
// rows.
//
// ONE FEED (Pato, 2026-08-17): the Upcoming/History split is gone. The EF
// orders "all" ascending, which would put the oldest thing you ever booked at
// the top — wrong for a feed. So it gets a client-side reorder: UPCOMING
// soonest-first, then PAST most-recent-first, which is how a reservations list
// actually reads.
export function ReservationsList({ empty }: { empty: ReactNode }) {
  const supabase = useBrowserSupabase();
  const [items, setItems] = useState<ReservationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reservations } = await apiListReservations(supabase, {
          scope: "all",
        });
        const rows = reservations.map(toReservationItem);
        if (!cancelled) setItems(orderOneFeed(rows));
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn't load your reservations."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (error) {
    return (
      <div className="px-4 pt-4">
        <p className={ERROR_BOX_CLASS}>{error}</p>
      </div>
    );
  }
  if (items === null) return <LoadingFill label="Loading reservations" />;
  if (items.length === 0) return <>{empty}</>;

  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-3">
        {items.map((r) => (
          <ReservationCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single-feed order: what's coming next, then what already happened.
 *
 * Upcoming ascends (the soonest booking is the one you need), past descends
 * (the most recent booking is the one you'd look up). A reservation counts as
 * upcoming while its slot is still ahead — the same date-aware rule the EF
 * uses for its scoped queries, so the two never disagree about which side of
 * the line a booking sits on.
 */
function orderOneFeed(rows: ReservationItem[]): ReservationItem[] {
  const now = Date.now();
  const at = (r: ReservationItem) => {
    const t = new Date(r.reservedAt ?? "").getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const upcoming: ReservationItem[] = [];
  const past: ReservationItem[] = [];
  for (const r of rows) (at(r) >= now ? upcoming : past).push(r);
  upcoming.sort((a, b) => at(a) - at(b));
  past.sort((a, b) => at(b) - at(a));
  return [...upcoming, ...past];
}
