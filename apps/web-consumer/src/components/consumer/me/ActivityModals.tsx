"use client";

import type { ReactNode } from "react";
import { Bell, CalendarCheck, QrCode } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { NotificationsClient } from "@/components/consumer/NotificationsClient";
import { ReservationsList } from "@/components/consumer/reservations-list";
import { VisitsList } from "@/components/consumer/me/VisitsList";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";

// Activity's three sections, as three sheets on Me (MESITA-1626).
//
// They were three nested routes under `/inbox` with a shared pill nav, which
// is what MESITA-1609 left behind when it took Activity off the bottom bar:
// a container with no tab, reachable only from three Me boxes that each deep-
// linked into one of its sections. The nav row was chrome about chrome — the
// guest had already chosen the section by tapping the box, and then landed on
// a page whose first element asked them to choose again.
//
// So the container is gone and each box owns a sheet. `/inbox/*` 308s to Me.
//
// NOTHING HERE FETCHES DIFFERENTLY. All three bodies are the same components
// the routes rendered; only the frame changed. The two that used to be server
// components were server-gated for a `userId` prop that neither consumer
// actually reads — `useConsumerTickets` calls `apiListConsumerTickets(supabase)`
// and only uses the id as a poll on/off flag, and `fetchConsumerNotifications`
// names its second parameter `_consumerId`. Both authenticate from the session
// inside their Edge Function, which is why these work as client sheets behind
// `(shell)`'s auth wall with no gate of their own.
//
// THE BODY SLOT IS A FLEX COLUMN, NOT A BLOCK. This is the one thing to get
// right and the old `inbox/layout.tsx` carries the scar tissue explaining why:
// every body here asks to grow (`EmptyState` is `flex-1 justify-center`,
// `NotificationsClient` and `VisitsList` are `h-full overflow-y-auto`), and a
// child of a block box silently collapses to content height. That shipped
// twice — zero states pinned to the top of a 700px empty frame, and a feed
// that could not scroll inside its own frame because a content-height box has
// nothing to overflow. `min-h-0` is load-bearing too: without it a flex child
// refuses to shrink below its content and the scroll moves to the sheet.

function ActivitySheet({
  open,
  onClose,
  title,
  blurb,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={title}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pt-5 pb-3">
          <h2 className={SHEET_TITLE_CLASS}>{title}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{blurb}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </LocalSheet>
  );
}

/** Alerts — your own activity feed. Global activity is the Social feed's job. */
export function AlertsModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  return (
    <ActivitySheet
      open={open}
      onClose={onClose}
      title="Alerts"
      blurb="Notifications and updates"
    >
      {userId ? (
        <NotificationsClient userId={userId} />
      ) : (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          description="Updates about your visits and reservations land here."
        />
      )}
    </ActivitySheet>
  );
}

/** Visits — every ticket you hold. Tapping one leaves for THE TICKET. */
export function VisitsModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  return (
    <ActivitySheet
      open={open}
      onClose={onClose}
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
    </ActivitySheet>
  );
}

/** Bookings — ONE feed: what's coming, then what already happened. */
export function BookingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <ActivitySheet
      open={open}
      onClose={onClose}
      title="Bookings"
      blurb="Upcoming first, then past"
    >
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
    </ActivitySheet>
  );
}
