"use client";

// Inbox section nav — the sticky pill row across the Inbox sections.
// Same vocabulary as HomeModeNav (the app has exactly one section-nav look):
// equal-width pills in a scrollbar-hidden scroller, active = solid primary
// + shadow-glow, real <Link> navigation between siblings under the shared
// /inbox layout.
//
// ORDERS FOLDED INTO VISITS (MESITA-1389). Orders had no table, no Edge
// Function and no type behind it — a pill that could never render anything —
// so it is gone, not renamed. An order is a visit you didn't sit down for; it
// reappears as rows inside Visits when it becomes real, and this row drops
// from four pills to three: Alerts · Visits · Reservations.
//
// ORDER IS LOAD-BEARING (Pato, 2026-09-01): Alerts leads because it is the
// only section that can carry something you have not seen yet; the rest runs
// from what you are doing right now out to what you have merely booked.
// Don't re-sort alphabetically or by how built-out each one is.
//
// WALLET LEFT FOR PAY. Activity holds EVENTS, a wallet holds INSTRUMENTS —
// the category error named on 08-31, closed by moving it rather than renaming
// the container around it. /inbox/credits 308s to /new-visit/wallet.
//
// THE DEFAULT IS NOT THE FIRST SECTION. Alerts leads this row but bare /inbox
// still lands on Visits: a visit in progress is time-critical, an alert can
// wait for you to look. That lives in CONSUMER_ROUTES.inboxDefault and is
// pinned by consumer-route-contract.test.ts. The mismatch is the decision.
//
// LABELS: only `notifications` still reads differently from its route (Alerts).
// `reservations` reads Reservations, not Bookings — that rename was tried and
// reverted on 2026-09-01, and this pass didn't reopen it.
//
// WIDTH. Every pill is a third of the track, `grid-flow-col auto-cols-fr` on a
// `w-max min-w-full` track — at rest min-w-full stretches the track to the
// frame and the fr columns split it evenly; at large accessibility text w-max
// lets the track outgrow the frame and the scroller takes over, columns still
// equal. The scroller is the FALLBACK, not the resting state.
//
//   frame   content   gaps   cols   each     widest pill needs        result
//   ------  --------  -----  -----  -------  -----------------------  ---------
//   375px   359px     8px    3      117.0px  "Reservations" ~96px     fits (+21)
//   448px   432px     8px    3      141.3px  "Reservations" ~96px     fits (+45)
//
// Budget per pill = text + 14px icon + 4px gap + 8px px-1. Dropping Orders
// freed a whole column's worth of gap and content, so the row that used to
// scroll at 375px (four columns, Reservations at ~86.8px vs. ~96px needed) now
// fits outright at three — no accessibility carve-out needed to keep this true.
//
// EVERY PILL CARRIES A SURFACE: equal columns still read as ragged when only
// the active pill is drawn, because the eye groups on text edges and the
// column edges are invisible. Drawing the resting surface makes the perceived
// rhythm the pill EDGES instead of the words, at zero width cost.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarCheck, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

type Section = { href: string; label: string; Icon: LucideIcon };

// decision: Pato (live, 2026-08-17) — Visits is FOOTPRINTS, not a QR code.
// The QR belongs to the Visit NAV TAB, and both were rendering on the same
// screen: an identical glyph in the tab bar and in the section row reads as
// one control drawn twice, and neither one tells you which is which. The QR
// is the thing you SHOW to start a visit; this section is the record that you
// WENT. Footprints says that, and collides with nothing else in the row
// (landmark / bag / calendar / bell).
//
// Wallet is WALLET (Pato, 2026-08-31), and this REVERSES a decision made two
// days earlier. "Two wallets, two words" held that the word belonged to the
// saved-card row in Me › More and must never appear on this side. That split
// is gone: this section now holds the cards as well as the Credits, so there
// is exactly one wallet and the word is free. api/cards.ts and CardsModal
// both carried the old note — updated in this same pass rather than left
// contradicting the screen.
//
// The glyph collides with nothing above it (footprints / bag / calendar /
// bell). CreditCard stays with the payment-methods row INSIDE the section,
// which is the level where "card" names a specific thing again.
//
// THIS ARRAY IS WHAT THE GUEST SEES. The route contract's key order has no
// runtime effect — nothing iterates it. route-structure.test.tsx T6 pins this
// array's order, count, labels and active state.
export const SECTIONS: Section[] = [
  { href: CONSUMER_ROUTES.inbox.notifications, label: "Alerts", Icon: Bell },
  { href: CONSUMER_ROUTES.inbox.visits, label: "Visits", Icon: Footprints },
  {
    href: CONSUMER_ROUTES.inbox.reservations,
    label: "Reservations",
    Icon: CalendarCheck,
  },
];

export function InboxSectionNav() {
  const pathname = usePathname();

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full grid-flow-col auto-cols-fr items-center gap-1">
          {SECTIONS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-full px-1 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
