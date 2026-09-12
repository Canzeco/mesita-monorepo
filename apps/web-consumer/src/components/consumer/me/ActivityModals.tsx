"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarCheck, QrCode } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";
import { ReservationsList } from "@/components/consumer/reservations-list";
import { VisitsList } from "@/components/consumer/me/VisitsList";
import { EmptyState } from "@/components/shared";
import { apiFetchConsumerProfile } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// Activity's three sections, as three full pages on Me (MESITA-1626,
// MESITA-1789).
//
// They were three nested routes under `/inbox` with a shared pill nav, which
// is what MESITA-1609 left behind when it took Activity off the bottom bar:
// a container with no tab, reachable only from three Me boxes that each deep-
// linked into one of its sections. The nav row was chrome about chrome — the
// guest had already chosen the section by tapping the box, and then landed on
// a page whose first element asked them to choose again.
//
// MESITA-1626 made each box a sheet. MESITA-1789 makes each box a route:
// /me/notifications, /me/visits, /me/reservations. `/inbox/*` still 308s to
// the hub. They are NOT @modal intercepts.
//
// NOTHING HERE FETCHES DIFFERENTLY. All three bodies are the same components
// the routes rendered; only the frame changed. `useConsumerTickets` calls
// `apiListConsumerTickets(supabase)` and only uses the id as a poll on/off
// flag, and `fetchConsumerNotifications` names its second parameter
// `_consumerId`. Both authenticate from the session inside their Edge
// Function.
//
// THE BODY SLOT IS A FLEX COLUMN, NOT A BLOCK. MeScreen's `flush` mode is
// the same contract the sheet had: grow, min-h-0, scroll inside the feed.

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

function useMeUserId(): string {
  const supabase = useBrowserSupabase();
  const [userId, setUserId] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (!cancelled) setUserId(consumer.id);
      } catch {
        // Empty id keeps the honest zero state until a retry lands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);
  return userId;
}

/** Alerts — your own activity feed. Global activity is the Social feed's job. */
export function AlertsModal() {
  const userId = useMeUserId();
  return (
    <ActivityPage title="Notifications" blurb="Notifications and updates">
      {userId ? (
        <NotificationsClient userId={userId} />
      ) : (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          description="Updates about your visits and reservations land here."
        />
      )}
    </ActivityPage>
  );
}

/** Visits — every ticket you hold. Tapping one leaves for THE TICKET. */
export function VisitsModal() {
  const userId = useMeUserId();
  return (
    <ActivityPage
      title="Visits"
      blurb="Live ones first, then everything you've closed"
    >
      {userId ? (
        <VisitsList userId={userId} />
      ) : (
        <EmptyState
          icon={QrCode}
          title="No visits yet"
          description="Start a visit from Pay and it shows up here — with its QR and whatever you saved."
          action={{ label: "Start a visit", href: CONSUMER_ROUTES.newVisit.root }}
        />
      )}
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
