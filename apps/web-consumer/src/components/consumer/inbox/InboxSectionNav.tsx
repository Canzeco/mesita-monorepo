"use client";

// Inbox section nav — the sticky pill row across the four Inbox sections.
// Same vocabulary as HomeModeNav (the app has exactly one section-nav look):
// content-width pills in a scrollbar-hidden scroller, active = solid primary
// + shadow-glow, real <Link> navigation between siblings under the shared
// /inbox layout.
//
// ORDER IS LOAD-BEARING (Pato, 2026-08-16): Visits · Orders · Reservations ·
// Notifications runs from the thing you're doing right now out to the passive
// feed. Don't re-sort these alphabetically or by how built-out they are.
//
// Width: the four labels measure ~429px of the 448px max-w-md frame, so they
// fit at rest with very little to spare — "Notifications" is the long pole.
// A fifth section, or a longer label, overflows into the scroller.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarCheck, Footprints, ShoppingBag } from "lucide-react";
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
// (bag / calendar / bell).
const SECTIONS: Section[] = [
  { href: CONSUMER_ROUTES.inbox.visits, label: "Visits", Icon: Footprints },
  { href: CONSUMER_ROUTES.inbox.orders, label: "Orders", Icon: ShoppingBag },
  {
    href: CONSUMER_ROUTES.inbox.reservations,
    label: "Reservations",
    Icon: CalendarCheck,
  },
  {
    href: CONSUMER_ROUTES.inbox.notifications,
    label: "Notifications",
    Icon: Bell,
  },
];

export function InboxSectionNav() {
  const pathname = usePathname();

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto px-2 py-2.5">
        {SECTIONS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]",
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
