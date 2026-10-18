"use client";

// Home's and Search's header row (MESITA-2401) — pills on the left half, one
// control on the right half:
//
//   Home     [ Places ][ Social·Soon ] (⌖ Tecnologico ⌄)   location = 50%
//   Search   [ Search ][ Chat·Soon ]                  (⚲)  Filters at the right
//
// PLACES IS THE CATALOG (Pato, MESITA-2254). MESITA-2301 restored the label
// after MESITA-2285 had renamed it Feed. Favorites left the header for the
// Places column (MESITA-2383); Chat left Home for the Search tab and the
// location moved up into Home's header (Pato, MESITA-2401). Soon pills wear
// Pay's chip (MESITA-2168); the chip sits above the pill, so it adds no width.
//
// It was DiscoverModeNav. Home draws it from app/(shell)/(discovery)/
// discover/layout.tsx; Search draws its own copy above the map
// (SearchHeader), so Home's pills never paint over the map (MESITA-1616).
//
// EVERY PILL IS AN EQUAL COLUMN: `grid-flow-col auto-cols-fr` on a
// `w-max min-w-full` track inside the left half. At rest min-w-full
// stretches the track to the half; at large accessibility text w-max lets it
// outgrow it and the scroller takes over. THE SCROLLER IS THE FALLBACK, NOT
// THE RESTING STATE — a row that scrolls at rest clips a label mid-word.
//
// THE MEASUREMENT (MESITA-2050), advance widths read from Inter 600's own
// hmtx table (2048 units/em):
//
//   label    text@12   + 26px chrome
//   -------  --------  -------------
//   Places   38.3      64.3   <- widest (MESITA-2166)
//   Social   36.7      62.7
//   Search   40.9      66.9   <- widest on Search
//   Chat     27.3      53.3
//
// Two columns in a half (175.5px of 359 less one 8px gap): 2 x 66.9 + 4 =
// 137.8. Fits. The icon is 14px (chrome 26) and the label stays at 12px
// (`text-xs`). route-structure.test.tsx T5b holds this arithmetic.

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { barePath } from "@/lib/surface";
import { Search, Sparkles, Store, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { LocationPicker } from "@/components/consumer/home/LocationPicker";

export type Mode = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // Social and Chat (MESITA-2168). Places has no chip: it is the catalog.
  soon?: boolean;
};

// THE ORDER IS PATO'S (MESITA-2401: "Home has Places and Social").
// Places leads and is the tab's default: the tab href is
// CONSUMER_ROUTES.discoverDefault, which is Places' href. Swipe and Scroll
// are legacy 308s to Places.
export const HOME_MODES: Mode[] = [
  {
    href: CONSUMER_ROUTES.discoverTabs.places,
    label: "Places",
    Icon: Store,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.social,
    label: "Social",
    Icon: Users,
    soon: true,
  },
];

// Search's pills (MESITA-2401: "Search, Chat, Filters"). Chat is Soon.
export const SEARCH_MODES: Mode[] = [
  { href: CONSUMER_ROUTES.search, label: "Search", Icon: Search },
  { href: CONSUMER_ROUTES.searchChat, label: "Chat", Icon: Sparkles, soon: true },
];

// The line under the tabs is stronger than a hairline (Pato, MESITA-2381):
// header and body read as two menus. The right half holds one control:
// Home's location, Search's Filters.
export function TabHeader({
  modes,
  label,
  aside,
}: {
  modes: readonly Mode[];
  /** The pill group's accessible name. */
  label: string;
  aside?: ReactNode;
}) {
  const pathname = barePath(usePathname() ?? "/");
  const supabase = useBrowserSupabase();
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Only bites when large accessibility text pushes the track past the half
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
    <div className="border-foreground/20 bg-background/90 sticky top-0 z-20 shrink-0 border-b-2 backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2 px-2" data-tab-header>
        {/* pt-3 clears the Soon chip: it hangs 8px above the pill, and
            overflow-x-auto clips anything past the padding edge. */}
        <nav aria-label={label} className="scrollbar-hide min-w-0 overflow-x-auto pt-3 pb-2.5">
          <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
            {modes.map(({ href, label: modeLabel, Icon, soon }) => {
              // EXACT match, never startsWith: nothing under one pill's href
              // may light it.
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  ref={isActive ? activeRef : undefined}
                  aria-current={isActive ? "page" : undefined}
                  // The switch itself, not the landing — `nav_tab_tap` fires
                  // on BottomNav only. The payload is the pill's label.
                  onClick={() => {
                    if (!isActive)
                      trackEvent(supabase, "home_mode_view", { mode: modeLabel });
                  }}
                  className={cn(base, "relative", isActive ? active : resting)}
                >
                  {soon && (
                    <span className="bg-muted text-muted-foreground ring-card type-meta pointer-events-none absolute -top-2 left-1/2 z-10 flex h-4 -translate-x-1/2 items-center rounded-full px-1.5 leading-none font-semibold whitespace-nowrap ring-2">
                      Soon
                    </span>
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span>{modeLabel}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="flex min-w-0 items-center justify-end pt-3 pb-2.5" data-tab-header-aside>
          {aside}
        </div>
      </div>
    </div>
  );
}

/** Home's header: Places · Social, the location in the right half. */
export function ModeTabs() {
  return <TabHeader modes={HOME_MODES} label="Home" aside={<LocationPicker />} />;
}
