"use client";

// Home's mode tabs — one row of pills over /discover/*:
//
//   Home    Places · Social · Chat · Favorites        (MESITA-2368)
//
// PLACES IS THE CATALOG (Pato, MESITA-2254). MESITA-2301 restored the label
// after MESITA-2285 had renamed it Feed. Favorites is a live tab, the saved
// grid (Pato, MESITA-2368). Social and Chat stay Soon
// (MESITA-2168) and wear Pay's chip. The chip sits above the pill, so it adds
// no width and the 359px budget holds.
//
// It was DiscoverModeNav. It is drawn by app/(shell)/(discovery)/discover/
// layout.tsx, so the pills share one frame and one deck fetch, and
// Search — its own bottom tab since MESITA-2055 — sits outside it with no
// tabs painting over the map (the MESITA-1616 bug cannot return).
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
//   Places   38.3      64.3   <- widest (MESITA-2166)
//   Social   36.7      62.7
//   Chat     27.3      53.3
//   Favorites 55.9     81.9   <- widest (MESITA-2368)
//
// Four columns: 4 x 81.9 + 12 = 339.6 of 359px. Fits.
// The icon is 14px (chrome 26) rather than the 16px of MESITA-1697: the
// budget was set when the row held five pills, and the label stays at 12px
// (`text-xs`) so the pills read the same whatever the count.
// route-structure.test.tsx T5b holds this arithmetic as an assertion.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { barePath } from "@/lib/surface";
import { Heart, Sparkles, Store, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

type Mode = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // Social and Chat (MESITA-2168). Places has no chip: it is the catalog.
  soon?: boolean;
};

// THE ORDER IS PATO'S (MESITA-2368: "Places, Social, Chat, Favorites").
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
  {
    href: CONSUMER_ROUTES.discoverTabs.chat,
    label: "Chat",
    Icon: Sparkles,
    soon: true,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.favs,
    label: "Favorites",
    Icon: Heart,
  },
];

export function ModeTabs() {
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
      {/* pt-3 clears the Soon chip: it hangs 8px above the pill, and
          overflow-x-auto clips anything past the padding edge. */}
      <div className="scrollbar-hide overflow-x-auto px-2 pt-3 pb-2.5">
        <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
          {HOME_MODES.map(({ href, label, Icon, soon }) => {
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
                className={cn(base, "relative", isActive ? active : resting)}
              >
                {soon && (
                  <span className="bg-muted text-muted-foreground ring-card type-meta pointer-events-none absolute -top-2 left-1/2 z-10 flex h-4 -translate-x-1/2 items-center rounded-full px-1.5 leading-none font-semibold whitespace-nowrap ring-2">
                    Soon
                  </span>
                )}
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
