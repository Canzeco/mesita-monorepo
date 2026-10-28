"use client";

import type { ReactNode } from "react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";

// Me's activity page: /me/notifications. Each Me tile is a route
// (MESITA-1789), so the page carries no section switcher — the guest chose
// the section by tapping the tile. `/inbox/*` 308s to the hub. It is NOT an
// @modal intercept. Reservations left Me for the bar's Bookings tab
// (MESITA-2518), then Saved › Reservations (MESITA-2521), and is its own Me
// page again, /me/reservations (MESITA-2565,
// components/consumer/saved/ReservationsPage.tsx).
//
// NOTHING HERE FETCHES. The body authenticates from the session inside
// its own Edge Function, so this file passes no id down.
//
// THE BODY SLOT IS A FLEX COLUMN, NOT A BLOCK. MeScreen's `flush` mode:
// grow, min-h-0, scroll inside the feed — a block parent collapses EmptyState.

/** Me › Notifications around its feed: MeScreen's bar and title and the
 *  flex column (its blurb restated the title; gone, MESITA-2983). The page
 *  passes the feed; /me/notifications' loading.tsx passes the feed's skeleton, so the frame and its fixed words
 *  exist once (Pato, MESITA-2701: "the placeholders must be similar to the
 *  page you are loading, like the sizes"). */
export function NotificationsFrame({ children }: { children: ReactNode }) {
  return (
    <MeScreen title="Notifications" flush>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </MeScreen>
  );
}

/** Alerts — your own activity feed. */
export function AlertsModal() {
  return (
    <NotificationsFrame>
      <NotificationsClient />
    </NotificationsFrame>
  );
}
