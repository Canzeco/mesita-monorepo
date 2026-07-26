"use client";

import { CalendarCheck } from "lucide-react";
import { ReservationsList } from "@/components/consumer/reservations-list";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";

// Standalone /reservations deep link. The Reservations bottom-tab lands on
// /saved/reservations (Upcoming/History); this route stays reachable for
// direct links and mirrors the Upcoming list. Booking is live (MESITA-715),
// so this reads consumer-web-list-reservations rather than a parked panel.

export const dynamic = "force-dynamic";

export default function ReservationsPage() {
  return <ReservationsBody />;
}

// Exported so other surfaces can mount the Upcoming list without duplicating
// the empty-state framing.
export function ReservationsBody() {
  return (
    <ReservationsList
      scope="upcoming"
      empty={
        <div className="scrollbar-hide h-full overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="bg-pink-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-2xl text-white">
              <CalendarCheck className="h-7 w-7" strokeWidth={2} />
            </span>
            <div className="flex flex-col items-center gap-1.5">
              <h2 className={SHEET_TITLE_CLASS}>No upcoming reservations</h2>
              <p className="text-muted-foreground max-w-xs text-sm leading-snug">
                Reserve a table from any place and Mesita calls to book it —
                your upcoming bookings show up here.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
