"use client";

import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { ReservationsList } from "@/components/consumer/reservations-list";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

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
//
// THE ZERO STATE IS THE SHARED PRIMITIVE (fixed 2026-08-20). This page used to
// hand-roll it: a 16x16 `bg-pink-gradient shadow-glow` tile with a WHITE glyph,
// its own gap-4/py-16 rhythm, and no next step — sitting one tab away from
// Visits and Orders, which render EmptyState's 14x14 tinted `bg-primary/10`
// tile on the mt-4/mt-1.5/mt-5 scale with a CTA. Same idea, same row of the
// same nav, two different visual languages and two different spacing scales:
// tab across and the artwork changed size, weight and colour treatment.
//
// The bespoke markup also carried `h-full`/`min-h-full`, which is why THIS
// section was the only one that centred correctly while Visits and Orders
// pinned to the top. That was a local patch over a layout bug, not a fix —
// the real cause was the Inbox children slot being a block box (see
// inbox/layout.tsx). With the slot corrected the primitive centres on its own,
// so the workaround came out with the duplicate styling.
export const dynamic = "force-dynamic";

export default function InboxReservationsPage() {
  return (
    <ReservationsList
      scope="all"
      empty={
        <EmptyState
          icon={CalendarCheck}
          title="No reservations yet"
          description="Reserve a table from any place and Mesita calls to book it — your bookings show up here."
          action={{ label: "Find a place", href: CONSUMER_ROUTES.discoverDefault }}
        />
      }
    />
  );
}
