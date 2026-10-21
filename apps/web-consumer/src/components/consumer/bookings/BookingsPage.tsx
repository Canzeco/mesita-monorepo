"use client";

import { CalendarCheck } from "lucide-react";

import { ReservationsList } from "@/components/consumer/reservations-list";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// BOOKINGS — the bar's fourth tab, /bookings (Pato, MESITA-2518: "add
// reservations at the bottom, since its one of the main uvps, call it
// bookins … just to clarify that you can make reservations in whatever
// fucking place you want … its already integrated").
//
//   Bookings                               one white header, no back button:
//   ─────────────────────────────────────  it is a tab, not a Me page
//   (▣) Book a table at any place. Mesita calls them for you …
//   ─────────────────────────────────────
//   upcoming, then past                    ReservationsList
//
// NOTHING HERE FETCHES. The list authenticates from the session inside its
// own Edge Function (consumer-web-list-reservations). It was Me ›
// Reservations (/me/reservations) until MESITA-2518; that address forwards
// here.
//
// THE LIST SLOT IS A FLEX COLUMN, NOT A BLOCK: grow, min-h-0, scroll inside
// the list — a block parent collapses EmptyState.
export function BookingsPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-bookings>
      <header className="border-border bg-card/95 sticky top-0 z-20 flex h-[52px] shrink-0 items-center border-b px-4 backdrop-blur">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Bookings
        </h1>
      </header>
      <div
        className="border-border bg-card flex shrink-0 items-center gap-3 border-b px-4 py-3"
        data-bookings-pitch
      >
        <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <CalendarCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <p className="text-muted-foreground text-sm leading-snug">
          Book a table at any place. Mesita calls them for you and your
          booking shows up here.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* ONE feed, no Upcoming/History control (Pato, 2026-08-17): the
            list orders it — what's next, then what happened. */}
        <ReservationsList
          empty={
            <EmptyState
              icon={CalendarCheck}
              title="No bookings yet"
              description="Open any place and tap Reserve — Mesita calls to book it."
              action={{
                label: "Find a place",
                href: CONSUMER_ROUTES.home,
              }}
            />
          }
        />
      </div>
    </div>
  );
}
