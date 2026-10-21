"use client";

import { Z_BOTTOM_NAV } from "@/lib/z-index";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { QrCode, Search, Send, User } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { cn } from "@/lib/utils";
import {
  CONSUMER_RESERVATION_SURFACE_PREFIX,
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_PREFIX,
} from "@/lib/consumer-route-contract";
import { barePath } from "@/lib/surface";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

// FIVE tabs, in this order (Pato, MESITA-2076 — "BOTTOM BAR MUST ONLY BE.
// Home. Search. Pay(Soon). Me."; MESITA-2518 added Bookings, MESITA-2521
// renamed it Saved; MESITA-2561 moved Saved under Me and made the fourth a
// Share button: "fourth menu item must be a share button. just a share
// button. no credits. no nothing"):
//
//   Home · Search · Pay (Soon) · Share · Me
//
//   SHARE IS A PAGE (Pato, MESITA-2566: "create a dedicate page for share").
//   The tab links to /share and lights there; the page holds the link and
//   the ways to send it. It was a tap that fired the share sheet
//   (MESITA-2561).
//
//   PAY IS ONE PAGE, THE SOON STATE (Pato, MESITA-2087: "Keep pay but delete
//   everything else. just the empty page with soon."). The tab is a plain
//   link to /pay like the others — it lights there — and wears the Soon
//   tag so the bar and the page make the same promise.
//
// Every tab shows its plain label. A tab label names a DESTINATION; state
// belongs on the page where it can be read and acted on (Pato, 2026-08-16:
// "only write me, its cleaner"). `route-structure.test.tsx` pins the labels,
// in order, and their count.

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
  // The destination is not built yet. The tab still navigates — its page is
  // the Soon state — and wears a "Soon" tag (Pato's own spelling, "Pay(Soon)",
  // overrides the MESITA-383 no-pill rule for this one tab).
  soon?: boolean;
};

const ITEMS: Item[] = [
  {
    // Home is one page; Social and Favorites are rows of it (MESITA-2405).
    href: CONSUMER_ROUTES.home,
    Icon: MesitaMark,
    label: "Home",
    matchPrefixes: [CONSUMER_ROUTES.home, CONSUMER_ROUTE_PREFIX.place],
  },
  {
    href: CONSUMER_ROUTES.search,
    Icon: Search,
    label: "Search",
    matchPrefixes: [CONSUMER_ROUTES.search],
  },
  {
    href: CONSUMER_ROUTES.pay,
    Icon: QrCode,
    label: "Pay",
    matchPrefixes: [CONSUMER_ROUTE_PREFIX.pay],
    soon: true,
  },
  {
    // A paper plane, Instagram's share glyph (MESITA-2564). Its page is the
    // link and the ways to send it (MESITA-2566).
    href: CONSUMER_ROUTES.share,
    Icon: Send,
    label: "Share",
    matchPrefixes: [CONSUMER_ROUTES.share],
  },
  {
    href: CONSUMER_ROUTES.me,
    Icon: User,
    label: "Me",
    // Me plus a reservation's detail: /reservation/{id} is reached from a
    // place AND from Me › Reservations, and that list is where you
    // land back (MESITA-2561; Saved owned it while Saved was a tab).
    matchPrefixes: [
      CONSUMER_ROUTE_PREFIX.me,
      CONSUMER_RESERVATION_SURFACE_PREFIX,
    ],
  },
];

export function BottomNav() {
  const pathname = barePath(usePathname() ?? "/");
  const getSupabase = useLazyBrowserSupabase();

  return (
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
      )}
    >
      <div className="flex items-end justify-around">
        {ITEMS.map((item) => {
          const { Icon, label } = item;
          const active = item.matchPrefixes.some((p) => pathname.startsWith(p));
          const soon = item.soon;
          const className = cn(
            "type-meta relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 font-medium transition",
            active
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          );
          const body = (
            <>
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
                  className={cn("h-5 w-5", soon && !active && "opacity-60")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {/* The tag is a quiet grey chip, sentence case, cut from the
                    glyph by a card-colour ring: the solid-ink uppercase pill
                    out-shouted every label in the bar (Pato, MESITA-2079). */}
                {soon && (
                  <span className="bg-muted text-muted-foreground ring-card type-meta absolute -top-0.5 left-[calc(100%-8px)] flex h-4 items-center rounded-full px-1.5 leading-none font-semibold whitespace-nowrap ring-2">
                    Soon
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </>
          );
          const track = () => {
            trackEvent(getSupabase(), "nav_tab_tap", { tab: label });
          };
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={track}
              className={className}
            >
              {body}
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
