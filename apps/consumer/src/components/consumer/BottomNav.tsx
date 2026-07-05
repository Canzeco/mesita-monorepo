"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Search, QrCode, CalendarCheck, User } from "lucide-react";
import { MesitaMark } from "./MesitaMark";
import { cn } from "@/lib/utils";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";

// Five top-level surfaces: Home, Search, Rewards, Reservations, Profile.
// Home hosts the discovery modes (Swipe / Social / Favorites); Search hosts the
// map, catalog search, and Ask AI. Rewards/Reservations/Profile reuse the
// existing pay, saved-reservations, and me surfaces unchanged.

// Icon is either a lucide glyph or the Mesita brand mark (Home) — both take
// a className and (harmlessly) a strokeWidth, so the render stays uniform.
type Item = {
  href: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  match: string;
};

const ITEMS: Item[] = [
  {
    href: CONSUMER_ROUTES.home,
    // Brand mark instead of a generic house — Home doubles as the Mesita anchor.
    Icon: MesitaMark,
    label: "Home",
    match: CONSUMER_ROUTE_PREFIX.home,
  },
  {
    href: CONSUMER_ROUTES.search,
    Icon: Search,
    label: "Search",
    match: CONSUMER_ROUTE_PREFIX.search,
  },
  {
    href: CONSUMER_ROUTES.pay.qr,
    Icon: QrCode,
    label: "Rewards",
    match: CONSUMER_ROUTE_PREFIX.pay,
  },
  {
    href: CONSUMER_ROUTES.saved.reservations,
    Icon: CalendarCheck,
    label: "Reservations",
    // Singular prefix also catches /saved/reservation/[id] detail views.
    match: CONSUMER_RESERVATION_SURFACE_PREFIX,
  },
  {
    href: CONSUMER_ROUTES.me.plan,
    Icon: User,
    label: "Profile",
    match: CONSUMER_ROUTE_PREFIX.me,
  },
];

export function BottomNav({ userId }: { userId?: string }) {
  // The inbox tab (and its pending-notification badge) left the tab bar when
  // Home/Search took over discovery; the prop stays so the shell layout call
  // site doesn't churn while other agents work this tree.
  void userId;
  const pathname = usePathname();

  return (
    <nav className="border-border bg-card/95 z-40 shrink-0 border-t px-0.5 pt-2 backdrop-blur">
      <div className="flex items-end justify-around">
        {ITEMS.map(({ href, Icon, label, match }) => {
          const active =
            pathname.startsWith(match) ||
            // Legacy deep links still hit /profile; keep the Profile tab lit
            // while those routes redirect.
            (match === CONSUMER_ROUTE_PREFIX.me &&
              pathname.startsWith(CONSUMER_ROUTES.legacy.profile)) ||
            // Old discovery surfaces map to Home until their links migrate.
            (match === CONSUMER_ROUTE_PREFIX.home &&
              pathname.startsWith(CONSUMER_ROUTE_PREFIX.explore));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" />
              )}

              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary/10 ring-primary/20 ring-1",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
