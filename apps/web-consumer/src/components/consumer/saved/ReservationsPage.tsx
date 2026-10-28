"use client";

import { CalendarCheck } from "lucide-react";

import {
  ReservationsList,
  ReservationsListSkeleton,
} from "@/components/consumer/reservations-list";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// RESERVATIONS — Me › Reservations, /me/reservations (Pato, MESITA-2565:
// "saved show reservations directly"). The one list, upcoming then past; it
// authenticates inside consumer-web-list-reservations. It was the second tab
// of Saved (MESITA-2521, MESITA-2561), the Bookings tab (MESITA-2518) and,
// before those, this same address.
//
// ONE feed, no Upcoming/History control (Pato, 2026-08-17): the list orders
// it — what's next, then what happened.
//
// THE PANE IS A FLEX COLUMN, NOT A BLOCK: grow, min-h-0, scroll inside — a
// block parent collapses EmptyState. One string for the page and its route
// fallback (MESITA-2701), as on Favorites.

const PANE =
  "scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain";

/** The Reservations pane while the route loads: the pane and the
 *  list's own skeleton, the card silhouettes ReservationsList draws while
 *  its read is out, so the fallback hands over to the list without a jump
 *  (Pato, MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"). */
export function ReservationsPageSkeleton() {
  return (
    <div className={PANE}>
      <ReservationsListSkeleton />
    </div>
  );
}

export function ReservationsPage() {
  return (
    <div className={PANE}>
      <ReservationsList
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="No reservations yet"
            description="Open any place and tap Reserve — Mesita calls to book it."
            action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
          />
        }
      />
    </div>
  );
}
