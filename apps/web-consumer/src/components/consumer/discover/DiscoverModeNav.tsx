"use client";

// Home's mode rail — the topbar menu across Home's five modes.
//
// SEARCH LEFT THIS RAIL FOR ITS OWN TAB (Pato, MESITA-1609), then its own
// ROUTE (MESITA-1616) — the tab move alone left Search's screen nested under
// this same layout, which kept this rail rendering above the map. Both
// concerns are gone now: Search shares neither this component nor its route
// with Home.
//
// EVERY PILL IS 20% (five modes, Feed joined at MESITA-1621), the same rule
// InboxSectionNav follows at three pills and PaySectionNav at two:
// `grid-flow-col auto-cols-fr` on a `w-max min-w-full` track. At rest
// min-w-full stretches the track to the frame and the fr columns split it
// evenly; at large accessibility text w-max lets the track outgrow the frame
// and the scroller takes over, columns still equal.
//
// THE SCROLLER IS THE FALLBACK, NOT THE RESTING STATE. A row that scrolls at
// rest clips a label mid-word and reads as a broken render rather than an
// affordance.
//
// THE MEASUREMENT, re-run for five columns (MESITA-1621) — the previous
// version of this block ended "a FIFTH mode back in this rail is the next
// time to re-measure", and this is that re-measure. `auto-cols-fr` sizes
// EVERY column to the widest pill, so the track is 5 x widest + 16px of gaps
// and it must fit 359px. At `type-label` (11px):
//
//   label    text   + 26px chrome   track (5w+16)   vs 359px
//   -------  -----  --------------  --------------  -----------
//   Swipe    31.8   57.8            305.0           fits (+54)
//   Feed     25.4   51.4            273.0           fits (+86)
//   Catalog  40.3   66.3            347.5           fits (+11.5)
//   Chat     24.5   50.5            268.5           fits (+90.5)
//   Favs     25.1   51.1            271.5           fits (+87.5)
//
// FEED'S 25.4 IS THE CONSERVATIVE TOP OF ITS BAND, not a fresh measurement in
// this table's units. Measured against its own neighbours in Inter 600 at
// 11px, "Feed" lands between "Favs" and "Chat"; it is entered at a hair above
// the wider of the two so a rounding error can only ever over-reserve. It is
// nowhere near the widest label, so the budget does not turn on it.
//
// CATALOG IS STILL THE WIDEST and it is now the binding constraint: 347.5 of
// 359px, ~11px of margin. `type-label` is no longer a preference — at
// `text-xs` (12px) Catalog's column alone would push the track past the
// frame, so the swap back that the four-column note called "a separate
// deliberate call" is off the table until a label gets shorter.
//
// Chrome per pill = 14px icon + 4px gap-1 + 8px px-1. A SIXTH mode, or any
// label wider than "Catalog", does NOT fit — 6 x 66.3 + 20 = 417.8. The next
// addition has to shorten a label, drop a mode, or give up the icons.
//

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Heart,
  LayoutGrid,
  Rows3,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

type Mode = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Parked: the pill opens a dialog instead of navigating. Body is on disk. */
  soon?: boolean;
  blurb?: string;
};

// ALL FIVE ARE LIVE; nothing here is parked — the `soon` branch below is kept
// for the next mode that lands unfinished, not because anything uses it
// today.
//
// SWIPE LEADS AND IS THE DEFAULT (Pato, MESITA-1615, live instruction),
// reversing MESITA-1609's Catalog call from earlier the same day. See
// consumer-route-contract.ts's discoverDefault comment for the
// first-pill-is-default reasoning, which is unaffected by which mode
// actually leads — it just carries over to Swipe now.
//
// FEED SITS SECOND, between Swipe and Catalog (Pato, MESITA-1621, live
// instruction). It is the deck as one two-column grid — the same places
// Swipe deals you one at a time, all at once — so it belongs beside Swipe,
// on the deck's side of the rail, not out past Catalog with Chat and Favs.
// Swipe still leads and is still the default; nothing about first-pill-is-
// default changes here.
//
// CATALOG is the catalog rails with no search bar on it — the reason two
// typed inputs one pill apart was ever a redundancy left with Search, so
// that argument is now historical, not load-bearing.
//
// Rows3 for Feed, against LayoutGrid for Catalog: both modes are grids of
// places, and the glyphs have to say which. Rows3's stacked full-width bars
// read as one column running down the screen (Feed pours the whole deck into
// one grid); LayoutGrid's four boxes read as sections (Catalog's rails).
//
// LayoutGrid, not House. #1449 swapped the grid for a house because the grid
// "read as four boxes next to the word Home" — correct then, and the same
// reasoning still holds: rails of category tiles ARE a grid, and a house
// next to the word Catalog would be the mismatch that commit was fixing.
export const MODES: Mode[] = [
  {
    href: CONSUMER_ROUTES.discoverTabs.swipe,
    label: "Swipe",
    Icon: Flame,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.feed,
    label: "Feed",
    Icon: Rows3,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.catalog,
    label: "Catalog",
    Icon: LayoutGrid,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.chat,
    label: "Chat",
    Icon: Sparkles,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.favs,
    label: "Favs",
    Icon: Heart,
  },
];

export function DiscoverModeNav() {
  const pathname = usePathname();
  const [soonMode, setSoonMode] = useState<Mode | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Only bites when large accessibility text pushes the track past the frame
  // and the scroller takes over. `nearest` makes it a no-op at rest, which is
  // the normal case — the columns fit.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  // `type-label` (11px), not `text-xs` (12px): "Catalog" is the widest label,
  // every column is sized to it, and at five columns 12px puts the fr track
  // well past the 359px frame. See THE MEASUREMENT.
  const base =
    "type-label flex items-center justify-center gap-1 rounded-full px-1 py-2 font-semibold whitespace-nowrap transition active:scale-[0.98]";
  const resting =
    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = "bg-primary text-primary-foreground shadow-glow";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
          {MODES.map((mode) => {
            const { href, label, Icon, soon } = mode;

            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setSoonMode(mode)}
                  aria-haspopup="dialog"
                  // 55% — the ladder has to read as a preview, not as five
                  // controls that silently do nothing. Contrast against 4.5:1
                  // is an open item; `bg-muted/60` at 55% is likely under.
                  className={cn(base, resting, "opacity-55")}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span>{label}</span>
                </button>
              );
            }

            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                ref={isActive ? activeRef : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(base, isActive ? active : resting)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <LocalDialog
        open={soonMode != null}
        onClose={() => setSoonMode(null)}
        ariaLabel={soonMode ? `${soonMode.label} — coming soon` : "Coming soon"}
      >
        {soonMode && (
          <ComingSoon mode={soonMode} onClose={() => setSoonMode(null)} />
        )}
      </LocalDialog>
    </div>
  );
}

// Coming-soon dialog body — tinted icon, badge, per-mode blurb, dismiss.
// Unchanged from HomeModeNav's, which this rail replaces.
function ComingSoon({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { Icon, label, blurb } = mode;
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <span className="bg-primary/10 text-primary inline-flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={2} />
      </span>
      <span className="bg-primary/10 text-primary type-meta rounded-full px-2.5 py-0.5 font-bold tracking-[0.14em] uppercase">
        Coming soon
      </span>
      <h2 className={SHEET_TITLE_CLASS}>{label}</h2>
      <p className="text-muted-foreground text-sm leading-snug">{blurb}</p>
      <button
        type="button"
        onClick={onClose}
        className="bg-primary text-primary-foreground mt-1 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition active:scale-[0.98]"
      >
        Got it
      </button>
    </div>
  );
}
