import type { ReactNode } from "react";
import { InboxSectionNav } from "@/components/consumer/inbox/InboxSectionNav";

export const dynamic = "force-dynamic";

// /inbox shared layout. Owns the one thing every section shares: the section
// pill nav. Because Next keeps a shared layout mounted across sibling
// navigations, switching sections never remounts the nav.
//
// Unlike /home there is no shared fetch here — the five sections read five
// different sources (credits, tickets, orders, reservations, notifications),
// so each leaf owns its own data and its own auth gate. Credits is the odd
// one: it reads neither a table nor an Edge Function, because there is no
// engine behind it yet — its balances come from a browser emulator.
//
// THE CHILDREN SLOT IS A FLEX COLUMN, not a block (fixed 2026-08-20). It used
// to be `min-h-0 flex-1 overflow-hidden`, which is a BLOCK box, and `flex-1`
// means nothing to a child of a block box. Every section leaf here asks to
// grow — EmptyState is `flex-1 justify-center`, NotificationsClient is
// `flex-1 overflow-y-auto` — so all of them silently collapsed to CONTENT
// height and pinned to the top of the frame. Two visible bugs came out of
// that one missing word:
//
//   · Visits and Orders rendered their zero state hard against the nav with
//     ~700px of dead space under it, which reads as a failed render. That is
//     the exact failure EmptyState's own rule #1 exists to prevent, and it
//     was being overridden from up here.
//   · Notifications never scrolled INSIDE its frame — a content-height box
//     can't overflow, so `overflow-y-auto` was inert and a long feed pushed
//     the frame instead of scrolling within it.
//
// Reservations looked right only because it hand-rolled `h-full`/`min-h-full`
// instead of using the shared primitive. That workaround is gone now; the
// container is simply honest about being a flex column, so `flex-1` works and
// all four sections align the same way.
export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <InboxSectionNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
