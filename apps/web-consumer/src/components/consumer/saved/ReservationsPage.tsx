"use client";

import { CalendarCheck } from "lucide-react";

import { ReservationsList } from "@/components/consumer/reservations-list";
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

export function ReservationsPage() {
  return (
    <div className="bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
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
