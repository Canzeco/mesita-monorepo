"use client";

import type { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";
import { ReservationsList } from "@/components/consumer/reservations-list";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Me's two activity pages: /me/notifications and /me/reservations. Each Me
// tile is a route (MESITA-1789), so neither page carries a section switcher —
// the guest chose the section by tapping the tile. `/inbox/*` 308s to the
// hub. They are NOT @modal intercepts.
//
// NOTHING HERE FETCHES. Both bodies authenticate from the session inside
// their own Edge Function, so this file passes no id down.
//
// THE BODY SLOT IS A FLEX COLUMN, NOT A BLOCK. MeScreen's `flush` mode:
// grow, min-h-0, scroll inside the feed — a block parent collapses EmptyState.

function ActivityPage({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <MeScreen title={title} flush>
      <p className="text-muted-foreground shrink-0 px-5 pt-4 pb-3 text-xs">
        {blurb}
      </p>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </MeScreen>
  );
}

/** Alerts — your own activity feed. */
export function AlertsModal() {
  return (
    <ActivityPage title="Notifications" blurb="Notifications and updates">
      <NotificationsClient />
    </ActivityPage>
  );
}

/** Bookings — ONE feed: what's coming, then what already happened. */
export function BookingsModal() {
  return (
    <ActivityPage title="Reservations" blurb="Upcoming first, then past">
      {/* ONE feed, no Upcoming/History control (Pato, 2026-08-17). The list
          orders it — what's next, then what happened — so the split survives
          as ORDER rather than as a second row of chrome. */}
      <ReservationsList
        scope="all"
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="No reservations yet"
            description="Reserve a table from any place and Mesita calls to book it — your bookings show up here."
            action={{
              label: "Find a place",
              href: CONSUMER_ROUTES.discoverDefault,
            }}
          />
        }
      />
    </ActivityPage>
  );
}
