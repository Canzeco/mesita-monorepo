"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, CalendarCheck, Ticket, Share2, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Five top-level surfaces. Reservations + Coupons replaced Saved + Pay
// when the consumer model split into reservations + coupons as separate
// first-class entities:
//
//   Discover     — Swipe / Catalog / Map / AI / Saved (Saved is now a
//                  Discover sub-route since it's part of how you find
//                  venues, not a wallet concern).
//   Reservations — booking entries only, no money fields shown.
//   Coupons      — the coupons wallet AND the QR-to-pay surface.
//   Share        — referral.
//   Profile      — account / settings.
const ITEMS = [
  {
    href: "/discover/swipe",
    Icon: Compass,
    // Label reads "Explore" while the underlying route stays /discover
    // (and the internal component names — DiscoverHeader, DiscoverTabs —
    // keep their existing identifiers). Cheap to flip the user-facing
    // word without a full route rename.
    label: "Explore",
    match: "/discover",
  },
  {
    href: "/reservations",
    Icon: CalendarCheck,
    label: "Reservations",
    match: "/reservations",
  },
  // Tab routes to /coupons but is branded "Pay & Win" — the surface
  // hosts the QR-to-pay AND the coupons wallet, and "Pay & Win" makes
  // the gambling-adjacent reward framing explicit (cashback, tier
  // upgrades). Route stays /coupons to avoid a redirect chain.
  { href: "/coupons", Icon: Ticket, label: "Pay & Win", match: "/coupons" },
  { href: "/share", Icon: Share2, label: "Share", match: "/share" },
  {
    href: "/profile",
    Icon: User,
    label: "Profile",
    match: "/profile",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-card/95 sticky bottom-0 z-40 shrink-0 border-t px-2 pt-2 backdrop-blur">
      <div className="flex justify-around">
        {ITEMS.map(({ href, Icon, label, match }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
