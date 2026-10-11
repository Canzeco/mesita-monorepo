"use client";

// Home's top rail — one row of pills over /discover/*:
//
//   Home    Catalog · Scroll · Chat · Favs      (MESITA-2134)
//
// It was DiscoverModeNav. It is drawn by app/(shell)/(discovery)/discover/
// layout.tsx, so the four pills share one frame and one deck fetch, and
// Search — its own bottom tab since MESITA-2055 — sits outside it with no
// rail painting over the map (the MESITA-1616 bug cannot return).
//
// A LABEL IS NOT A ROUTE: Catalog is /discover/feed (CatalogRails at Feed's
// address) and Scroll is /discover/scroll (the deck, Swipe's segment).
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
//   Catalog  44.8      70.8   <- widest (MESITA-2134)
//   Scroll   33.0      59.0
//   Chat     27.3      53.3
//   Favs     27.6      53.6
//
// Four columns: 4 x 70.8 + 12 = 295.2 of 359px. Fits, with room to spare.
// The icon is 14px (chrome 26) rather than the 16px of MESITA-1697: the
// budget was set when the row held five pills, and the label stays at 12px
// (`text-xs`) so the pills read the same whatever the count.
// route-structure.test.tsx T5b holds this arithmetic as an assertion.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { barePath } from "@/lib/surface";
import {
  Flame,
  Heart,
  LayoutGrid,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

type Mode = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

// THE ORDER IS PATO'S, verbatim (MESITA-2134: "catalog, scroll, chat,
// favs"). Catalog leads and is the tab's default — the tab href is
// CONSUMER_ROUTES.discoverDefault, which is Catalog's href, so the pill a
// guest lands on is the first one they see.
//
// CATALOG IS FEED under the name of what it shows: CatalogRails at
// /discover/feed. It read "Home" from MESITA-2081 until MESITA-2134, which
// left the bottom tab as the only Home.
//
// SCROLL IS THE DECK under its own name, keeping the flame that has marked it
// since it was Swipe. Four pills fit the track with room to spare; T5b holds
// the arithmetic.
export const HOME_MODES: Mode[] = [
  {
    href: CONSUMER_ROUTES.discoverTabs.feed,
    label: "Catalog",
    Icon: LayoutGrid,
  },
  { href: CONSUMER_ROUTES.discoverTabs.scroll, label: "Scroll", Icon: Flame },
  { href: CONSUMER_ROUTES.discoverTabs.chat, label: "Chat", Icon: Sparkles },
  { href: CONSUMER_ROUTES.discoverTabs.favs, label: "Favs", Icon: Heart },
];

export function ModeRail() {
  const pathname = barePath(usePathname() ?? "/");
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
          {HOME_MODES.map(({ href, label, Icon }) => {
            // EXACT match, never startsWith: nothing under one pill's href may
            // light it.
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                ref={isActive ? activeRef : undefined}
                aria-current={isActive ? "page" : undefined}
                // The switch itself, not the landing — `nav_tab_tap` fires on
                // BottomNav only. The payload is the pill's label.
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
