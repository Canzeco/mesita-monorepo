"use client";

// Inbox section nav — the sticky pill row across the five Inbox sections.
// Same vocabulary as HomeModeNav (the app has exactly one section-nav look):
// equal-width pills in a scrollbar-hidden scroller, active = solid primary
// + shadow-glow, real <Link> navigation between siblings under the shared
// /inbox layout.
//
// ORDER IS LOAD-BEARING (Pato, 2026-09-01): Alerts · Visits · Orders ·
// Reservations. Alerts leads because it is the only section that can carry
// something you have not seen yet; the rest runs from what you are doing right
// now out to what you have merely booked. Don't re-sort alphabetically or by
// how built-out each one is.
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
// `reservations` went back to reading Reservations on 2026-09-01, so Bookings
// is gone and with it the widest pill this row ever carried.
//
// WIDTH. Every pill is 25%, `grid-flow-col auto-cols-fr` on a `w-max
// min-w-full` track — at rest min-w-full stretches the track to the frame and
// the fr columns split it evenly; at large accessibility text w-max lets the
// track outgrow the frame and the scroller takes over, columns still equal.
// The scroller is the FALLBACK, not the resting state.
//
//   frame   content   gaps   cols   each     widest pill needs        result
//   ------  --------  -----  -----  -------  -----------------------  ---------
//   375px   359px     12px   4      86.8px   "Reservations" ~96px     SCROLLS
//   448px   432px     12px   4      105px    "Reservations" ~96px     fits (+9)
//
// Budget per pill = text + 14px icon + 4px gap + 8px px-1. Reservations is the
// longest label this row has ever had, so a real 375px phone scrolls it —
// accepted when the label reverted from Bookings. Dropping the icons would
// free 18px per pill and fit outright; that was declined on 2026-09-01, so the
// icons stay and the phone scrolls.
//
// EVERY PILL CARRIES A SURFACE: equal columns still read as ragged when only
// the active pill is drawn, because the eye groups on text edges and the
// column edges are invisible. Drawing the resting surface makes the perceived
// rhythm the pill EDGES instead of the words, at zero width cost.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  Footprints,
  ShoppingBag,
} from "lucide-react";
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
  { href: CONSUMER_ROUTES.inbox.orders, label: "Orders", Icon: ShoppingBag },
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
