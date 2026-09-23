"use client";

// The top rail of a bottom tab — one component, two rows of pills (Pato,
// MESITA-2050: "Visit. Order. Wallet. Me. · Home(scroll). Search. Chat. Favs.
// Pay. · Order must have Home.").
//
//   Visit   Home · Search · Chat · Favs · Pay
//   Order   Home
//
// It was DiscoverModeNav, Home's rail alone. Two things changed at once:
//
//   THE RAIL SPANS THREE NAMESPACES NOW. Visit's pills live at /discover/*,
//   /search and /new-visit, and none of those URLs moved — the rail is drawn
//   by app/(shell)/(visit)/layout.tsx, a route group, so it can sit above all
//   three without renaming any of them. That retires the old "segments match
//   labels" rule for this rail: Home is /discover/scroll, and Pay is
//   /new-visit, and a label is not a route (the same rule the Pay tab has
//   lived by through four renames).
//
//   SEARCH IS UNDER A RAIL AGAIN, on purpose. MESITA-1616 moved it out from
//   under discover/layout.tsx because Home's rail painting above the map was
//   a bug THEN — Search was its own tab. It is a pill of Visit now, so the
//   rail above the map is the design.
//
// ORDER'S ROW IS ONE PILL, deliberately. A one-pill row is chrome that cannot
// switch anything, and the Pay section row was deleted for exactly that
// reason once. Pato asked for Home here anyway ("Order must have Home"), and
// the row is what makes Order read as the same kind of tab as Visit: the
// next Order mode is an append to ORDER_MODES, not a new frame.
//
// EVERY PILL IS AN EQUAL COLUMN: `grid-flow-col auto-cols-fr` on a
// `w-max min-w-full` track. At rest min-w-full stretches the track to the
// frame; at large accessibility text w-max lets it outgrow the frame and the
// scroller takes over. THE SCROLLER IS THE FALLBACK, NOT THE RESTING STATE —
// a row that scrolls at rest clips a label mid-word.
//
// THE MEASUREMENT (MESITA-2050), advance widths read from Inter 600's own
// hmtx table (2048 units/em), so a hair above the older hand-derived table:
//
//   label    text@12   + 26px chrome
//   -------  --------  -------------
//   Search   40.9      66.9   <- widest
//   Home     34.2      60.2
//   Chat     27.3      53.3
//   Favs     27.6      53.6
//   Pay      21.7      47.7
//
// Five columns: 5 x 66.9 + 16 = 350.5 of 359px. Fits, with ~8px to spare.
// It fits ONLY because the icon went back to 14px: at 16px (the four-column
// size, MESITA-1697) chrome is 28 and the track is 360.5 — one pixel over.
// The label stays at 12px (`text-xs`); the icon gave up the two pixels
// instead of the type. A SIXTH pill does not fit at any size worth reading.
// route-structure.test.tsx T5b holds this arithmetic as an assertion.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Heart, MapPin, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export type Mode = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

// THE ORDER IS PATO'S, verbatim. Home leads and is Visit's default — the tab
// href is CONSUMER_ROUTES.discoverDefault, which is Home's href, so the pill
// a guest lands on is the first one they see.
//
// Home is the Scroll deck under a new label: the flame stays, because it has
// marked this deck since it was Swipe and the deck underneath did not
// change. Feed (the catalog rails) is NOT here — Pato's list drops it, and
// /discover/feed 308s to Home. CatalogRails stays on disk.
//
// Pay keeps the QR glyph it wore as a bottom tab: showing the QR is the pay.
export const HOME_MODES: Mode[] = [
  { href: CONSUMER_ROUTES.discoverTabs.scroll, label: "Home", Icon: Flame },
  { href: CONSUMER_ROUTES.discoverTabs.chat, label: "Chat", Icon: Sparkles },
  { href: CONSUMER_ROUTES.discoverTabs.favs, label: "Favs", Icon: Heart },
];

// Order remains routable, but is no longer a bottom-bar destination.
export const ORDER_MODES: Mode[] = [
  { href: CONSUMER_ROUTES.order.home, label: "Home", Icon: MapPin },
];

export function ModeRail({ modes }: { modes: Mode[] }) {
  const pathname = usePathname();
  const supabase = useBrowserSupabase();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Only bites when large accessibility text pushes the track past the frame
  // and the scroller takes over. `nearest` makes it a no-op at rest.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  const base =
    "text-xs flex items-center justify-center gap-1 rounded-full px-1 py-2 font-semibold whitespace-nowrap transition active:scale-[0.98]";
  const resting =
    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = "bg-primary text-primary-foreground shadow-glow";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
          {modes.map(({ href, label, Icon }) => {
            // EXACT match, never startsWith: nothing under one pill's href may
            // light it, and /new-visit is a prefix of nothing live any more
            // only because Wallet moved to /wallet (MESITA-2050).
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                ref={isActive ? activeRef : undefined}
                aria-current={isActive ? "page" : undefined}
                // The switch itself, not the landing — `nav_tab_tap` fires on
                // BottomNav only. The event name predates Visit; the payload
                // is the pill's label.
                onClick={() => {
                  if (!isActive)
                    trackEvent(supabase, "home_mode_view", { mode: label });
                }}
                className={cn(base, isActive ? active : resting)}
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
