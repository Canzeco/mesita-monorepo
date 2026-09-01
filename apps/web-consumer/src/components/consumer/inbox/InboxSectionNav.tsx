"use client";

// Inbox section nav — the sticky pill row across the five Inbox sections.
// Same vocabulary as HomeModeNav (the app has exactly one section-nav look):
// equal-width pills in a scrollbar-hidden scroller, active = solid primary
// + shadow-glow, real <Link> navigation between siblings under the shared
// /inbox layout.
//
// ORDER IS LOAD-BEARING (Pato, 2026-08-16; Wallet added first 2026-09-01):
// Wallet · Visits · Orders · Bookings · Alerts. Wallet leads because money
// is what a guest checks first; the rest still runs from the thing you're
// doing right now out to the passive feed. Don't re-sort these alphabetically
// or by how built-out they are.
//
// THE DEFAULT IS NOT THE FIRST SECTION. Wallet leads this row but bare
// /inbox lands on Visits — a visit in progress is time-critical, a balance
// never is. That decision lives in CONSUMER_ROUTES.inboxDefault and is pinned
// by consumer-route-contract.test.ts.
//
// LABEL RENAMES, ROUTES UNCHANGED (2026-09-01): Reservations reads Bookings
// and Notifications reads Alerts. A rename stops at the label — the routes
// stay /inbox/reservations and /inbox/notifications. The renames are not
// cosmetic: they are what bought the fifth column (see the width block).
//
// CREDITS READS WALLET (Pato, 2026-08-31), same rule, route still
// /inbox/credits. This one is not a relabel of the same thing — the section
// GREW. It used to hold per-place prepaid balances and nothing else; it now
// holds those, gifting, and the saved payment methods that were buried in
// Me › More › Cards. "Credits" named one of the three things inside, which is
// the mistake the container name exists to avoid — and it would have collided
// outright once the universal Mesita Credits balance ships (MESITA-1380) and
// lands in this same stack as a card literally called Credits.
//
// Wallet is 6 characters against Credits' 7, so this rename only ever RELAXES
// the width budget below. "Bookings" is still the widest pill and the
// arithmetic is unchanged.
//
// Width: EVERY PILL IS 20% (was 25% at four sections). Content-width pills
// made the row read as five unrelated chips of random length; equal fifths
// read as one segmented control. `grid-flow-col auto-cols-fr` on a `w-max
// min-w-full` track does both jobs — at rest min-w-full stretches the track to
// the frame and the fr columns split it evenly; at large accessibility text
// w-max lets the track outgrow the frame and the scroller takes over, columns
// still equal (all sized to the widest label).
//
// THE MEASUREMENT, because the old version of this comment only ever
// described the 448px frame and that is not where the constraint binds:
//
//   frame   content   cols   each     widest pill needs        result
//   ------  --------  -----  -------  -----------------------  -----------
//   448px   432px     5      83.2px   "Bookings"      76px     fits (+7)
//   448px   432px     5      83.2px   "Notifications" 98px     OVERFLOWS
//   375px   359px     5      68.6px   "Bookings"      76px     scrolls
//   375px   359px     4      86.8px   "Notifications" 98px     scrolls TODAY
//
// Budget per pill = text + 14px icon + 4px gap + 8px px-1. Read the last two
// rows together: at a real 375px phone THE FOUR-PILL ROW ALREADY SCROLLED
// before Credits existed. Adding a fifth section does not regress the phone,
// it inherits a condition the 448px arithmetic never saw. Dropping the icons
// would free 18px per pill and fit 375px outright; that was offered and
// declined (Pato, 2026-09-01) — the icons stay, the phone scrolls.
//
// A SIXTH section makes the columns 66.4px at 448px, which nothing here fits
// with icons. Re-measure at 375px, not 448px, before adding one.
//
// EVERY PILL CARRIES A SURFACE (fixed 2026-08-20, Pato: "fix the spaces and
// bad spacing margin. it looks like shit"). The columns were already exact —
// the RAGGED part was never the geometry, it was that only the active pill
// had a background. Centred text inside equal invisible columns is read by the
// eye as labels with arbitrary gaps, because the eye groups on text edges and
// the column edges aren't drawn. One solid pill among bare words made it worse
// — the row read as "a button, and then some labels", not one segmented
// control.
//
// Drawing the inactive surface fixes it without touching the equal-width rule:
// the rhythm you perceive is pill EDGES (equal columns, uniform gap-1) instead
// of word edges. A background costs zero width, so the px-1 budget above is
// untouched. Contrast stays carried by fill, not by presence — active is solid
// primary + glow, resting is a muted surface.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  Footprints,
  ShoppingBag,
  Wallet,
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
  { href: CONSUMER_ROUTES.inbox.credits, label: "Wallet", Icon: Wallet },
  { href: CONSUMER_ROUTES.inbox.visits, label: "Visits", Icon: Footprints },
  { href: CONSUMER_ROUTES.inbox.orders, label: "Orders", Icon: ShoppingBag },
  {
    href: CONSUMER_ROUTES.inbox.reservations,
    label: "Bookings",
    Icon: CalendarCheck,
  },
  {
    href: CONSUMER_ROUTES.inbox.notifications,
    label: "Alerts",
    Icon: Bell,
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
