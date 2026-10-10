"use client";

import { Z_BOTTOM_NAV } from "@/lib/z-index";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { QrCode, Search, User } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { ComingSoonModal } from "./ComingSoonModal";
import { cn } from "@/lib/utils";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";
import { barePath } from "@/lib/surface";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

// FOUR tabs, in this order (Pato, MESITA-2076 — "hide some shit for the
// moment and focus mvp"):
//
//   Home · Search · Pay (Soon) · Me
//
//   PAY is parked: it stays on the bar so the guest knows it is coming, and
//   a tap opens ComingSoonModal instead of /new-visit. Its "Soon" tag is
//   Pato's own spelling ("Pay(Soon)") and overrides the MESITA-383 no-pill
//   rule for this one tab. /new-visit and /visit/{id} stay routable and
//   light no tab while Pay is parked.
//   WALLET left the bar (it was a tab from MESITA-2050/2055). /wallet and
//   its four children stay routable; nothing on the bar lights them.
//   Un-park Pay = drop `soon` and restore its matchPrefixes.
//
// Every tab shows its plain label. A tab label names a DESTINATION; state
// (class, Diamond) belongs on the page where it can be read and acted on
// (Pato, 2026-08-16: "only write me, its cleaner"). `route-structure.test.tsx`
// pins the labels, in order, and their count.

// Every icon is a lucide glyph except Home's, which carries the brand mark.
// The signature stays wider than LucideIcon so the mark fits.
type Item = {
  href: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  /**
   * Every pathname prefix that lights this tab. A LIST, because a tab that
   * owns detail routes outside its own namespace must name each one — a
   * detail route that stops nesting under its tab's prefix lights NOTHING,
   * which tsc cannot see and only route-structure T5 catches.
   *
   * Order is irrelevant; matching is `startsWith` over the whole list.
   */
  matchPrefixes: readonly string[];
  // Surface is parked. Tab stays visible and tappable, wears a "Soon" tag,
  // and a tap opens ComingSoonModal instead of navigating (MESITA-2076).
  soon?: boolean;
  soonTitle?: string;
  soonBody?: string;
};

const ITEMS: Item[] = [
  {
    // Home owns its rail: Home (Feed), Scroll, Chat and Favs.
    href: CONSUMER_ROUTES.discoverDefault,
    Icon: MesitaMark,
    label: "Home",
    matchPrefixes: [
      CONSUMER_ROUTES.discoverTabs.feed,
      CONSUMER_ROUTES.discoverTabs.scroll,
      CONSUMER_ROUTES.discoverTabs.chat,
      CONSUMER_ROUTES.discoverTabs.favs,
      CONSUMER_ROUTE_PREFIX.place,
    ],
  },
  {
    href: CONSUMER_ROUTES.search,
    Icon: Search,
    label: "Search",
    matchPrefixes: [CONSUMER_ROUTES.search],
  },
  {
    href: CONSUMER_ROUTES.newVisit.root,
    Icon: QrCode,
    label: "Pay",
    // Parked: lights nothing. Un-parking restores
    // [CONSUMER_ROUTE_PREFIX.newVisit, CONSUMER_ROUTE_PREFIX.visit].
    matchPrefixes: [],
    soon: true,
    soonTitle: "Pay is coming soon",
    soonBody:
      "Paying at a place with Mesita lands here shortly — thanks for waiting.",
  },
  {
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    // /me/* plus reservations: /reservation/{id} is reached from a place AND
    // from Me › Reservations, and the list is where you land back. /visit
    // left this list for Visit (MESITA-2050).
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.me,
      CONSUMER_RESERVATION_SURFACE_PREFIX,
    ],
  },
];

export function BottomNav({
  userId,
  className,
}: {
  userId?: string;
  className?: string;
}) {
  // The inbox tab (and its pending-notification badge) left the tab bar at
  // MESITA-1609; the prop stays so the shell layout call site doesn't churn.
  void userId;
  const pathname = barePath(usePathname() ?? "/");
  const [soonItem, setSoonItem] = useState<Item | null>(null);
  const getSupabase = useLazyBrowserSupabase();

  return (
    <>
      <nav
        // Hook for surfaces that own their whole frame and suppress the tab
        // bar in CSS (place detail — see PlaceDetailPageBody). A data attribute
        // rather than a route list here: whether the nav belongs on a screen is
        // that screen's statement, and the pathname alone can't tell the
        // hard-nav place PAGE from the intercepted place MODAL, which share it.
        data-shell-nav=""
        className={cn(
          "border-border bg-card/95 shrink-0 border-t px-0.5 pt-2 backdrop-blur",
          Z_BOTTOM_NAV,
          className,
        )}
      >
        <div className="flex items-end justify-around">
          {ITEMS.map((item) => {
            const { href, Icon, label, matchPrefixes, soon } = item;
            const active = matchPrefixes.some((p) => pathname.startsWith(p));
            // Parked surfaces stay tappable — open ComingSoonModal. The tag is a
            // quiet grey chip, sentence case, cut from the glyph by a card-colour
            // ring: the solid-ink uppercase pill out-shouted every label in the
            // bar (Pato, MESITA-2079).
            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => {
                    trackEvent(getSupabase(), "nav_tab_tap", { tab: label });
                    setSoonItem(item);
                  }}
                  aria-haspopup="dialog"
                  title={item.soonTitle ?? "Coming soon"}
                  className="text-muted-foreground hover:text-foreground type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition"
                >
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full">
                    <Icon className="h-5 w-5 opacity-60" strokeWidth={1.75} />
                    <span className="bg-muted text-muted-foreground ring-card type-meta absolute -top-0.5 left-[calc(100%-8px)] flex h-4 items-center rounded-full px-1.5 leading-none font-semibold whitespace-nowrap ring-2">
                      Soon
                    </span>
                  </span>
                  <span className="w-full truncate text-center">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  trackEvent(getSupabase(), "nav_tab_tap", { tab: label });
                }}
                className={cn(
                  "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
                )}
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                    active && "bg-primary/10 ring-primary/20 ring-1",
                  )}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
      </nav>
      <ComingSoonModal
        open={soonItem != null}
        onClose={() => setSoonItem(null)}
        title={soonItem?.soonTitle ?? "Coming soon"}
        body={soonItem?.soonBody}
        // Item.Icon is deliberately wider than LucideIcon (Home renders the
        // brand mark), so it can't be forwarded here. Pay is the one parked
        // tab, and QrCode is its glyph.
        icon={QrCode}
      />
    </>
  );
}
