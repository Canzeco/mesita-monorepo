"use client";

import { CalendarCheck } from "lucide-react";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { ReservationsList } from "@/components/consumer/reservations-list";

// Inbox › Reservations — ONE feed (Pato, 2026-08-17: "remove upcoming and
// history, all in the same feed").
//
// The Upcoming/History segmented control is gone. It was a second row of
// navigation stacked directly under the Inbox section nav, and with the
// sections carrying the top-level split it was reading as chrome about chrome.
// The list itself orders the feed — what's coming next, then what already
// happened — so the split survives as ORDER instead of as a control.
//
// Canonical path is /inbox/reservations; /reservations and
// /saved/reservations redirect here. The singular DETAIL stays at
// /reservation/[id] — moving the list didn't rename the object.

export const dynamic = "force-dynamic";

export default function InboxReservationsPage() {
  return (
    <ReservationsList
      scope="all"
      empty={
        <div className="scrollbar-hide h-full overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="bg-pink-gradient shadow-glow flex h-16 w-16 items-center justify-center rounded-2xl text-white">
              <CalendarCheck className="h-7 w-7" strokeWidth={2} />
            </span>
            <div className="flex flex-col items-center gap-1.5">
              <h2 className={SHEET_TITLE_CLASS}>No reservations yet</h2>
              <p className="text-muted-foreground max-w-xs text-sm leading-snug">
                Reserve a table from any place and Mesita calls to book it —
                your bookings show up here.
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
