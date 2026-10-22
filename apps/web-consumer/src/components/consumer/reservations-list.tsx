"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  ReservationCard,
  ReservationCardSkeleton,
} from "@/components/consumer/ReservationCard";
import { apiListReservations } from "@/lib/api/reservations";
import type { ReservationItem } from "@/lib/reservation-types";
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

/** The list's scroller (16px in, 16px above and below) and its 12px step:
 *  one set for the cards and their skeleton. */
const LIST_SCROLLER = "scrollbar-hide h-full overflow-y-auto px-4 py-4";
const LIST_STACK = "flex flex-col gap-3";

/** The list while consumer-web-list-reservations is out, and the whole of
 *  /me/reservations/loading.tsx's pane (Pato, MESITA-2701: "the
 *  placeholders must be similar to the page you are loading, like the
 *  sizes"; a centred spinner before): four ReservationCardSkeletons on the
 *  list's own padding and step, enough to fill a phone, so the cards land
 *  where their silhouettes stood. One component for both, so the route
 *  fallback and the list's null state cannot drift. */
export function ReservationsListSkeleton() {
  return (
    <div className={LIST_SCROLLER}>
      <div className={LIST_STACK}>
        {[0, 1, 2, 3].map((i) => (
          <ReservationCardSkeleton key={i} />
        ))}
      </div>
      <p role="status" className="sr-only">
        Loading reservations
      </p>
    </div>
  );
}

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
  if (items === null) return <ReservationsListSkeleton />;
  if (items.length === 0) return <>{empty}</>;

  return (
    <div className={LIST_SCROLLER}>
      <div className={LIST_STACK}>
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
