"use client";

// Home's mode rail — the topbar menu across Home's four modes.
//
// SEARCH LEFT THIS RAIL FOR ITS OWN TAB (Pato, MESITA-1609), then its own
// ROUTE (MESITA-1616) — the tab move alone left Search's screen nested under
// this same layout, which kept this rail rendering above the map. Both
// concerns are gone now: Search shares neither this component nor its route
// with Home.
//
// EVERY PILL IS 25% (four modes), the same rule InboxSectionNav follows at
// three pills and PaySectionNav at two: `grid-flow-col auto-cols-fr` on a
// `w-max min-w-full` track. At rest min-w-full stretches the track to the
// frame and the fr columns split it evenly; at large accessibility text
// w-max lets the track outgrow the frame and the scroller takes over, columns
// still equal.
//
// THE SCROLLER IS THE FALLBACK, NOT THE RESTING STATE. A row that scrolls at
// rest clips a label mid-word and reads as a broken render rather than an
// affordance.
//
// THE MEASUREMENT, and it is no longer tight — dropping Search bought real
// margin back. `auto-cols-fr` sizes EVERY column to the widest pill, so the
// track is 4 x widest + 16px of gaps and it must fit 359px. At `type-label`
// (11px), reusing the per-label widths measured for the five-mode row (no
// mode's own width changes when a sibling leaves or the row reorders):
//
//   label    text   + 26px chrome   track (4w+16)   vs 359px
//   -------  -----  --------------  --------------  -----------
//   Swipe    31.8   57.8            247.2           fits (+112)
//   Catalog  40.3   66.3            281.2           fits (+78)
//   Chat     24.5   50.5            218.0           fits (+141)
//   Favs     25.1   51.1            220.4           fits (+139)
//
// CATALOG IS STILL THE WIDEST, so `type-label` stays the type token even
// though the 7px squeeze that originally forced it (see consumer-route-
// contract.ts's discoverDefault comment for that history) no longer applies
// at four columns — reverting to `text-xs` here would be a separate,
// deliberate call this PR does not make.
//
// Chrome per pill = 14px icon + 4px gap-1 + 8px px-1. A FIFTH mode back in
// this rail, or any label wider than "Catalog", is the next time to
// re-measure — there is real margin now, but it is not unlimited.
//

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Heart,
  LayoutGrid,
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

// ALL FOUR ARE LIVE; nothing here is parked — the `soon` branch below is kept
// for the next mode that lands unfinished, not because anything uses it
// today.
//
// SWIPE LEADS AND IS THE DEFAULT (Pato, MESITA-1615, live instruction),
// reversing MESITA-1609's Catalog call from earlier the same day. See
// consumer-route-contract.ts's discoverDefault comment for the
// first-pill-is-default reasoning, which is unaffected by which mode
// actually leads — it just carries over to Swipe now.
//
// CATALOG is the catalog rails with no search bar on it — the reason two
// typed inputs one pill apart was ever a redundancy left with Search, so
// that argument is now historical, not load-bearing.
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

  // `type-label` (11px), not `text-xs` (12px): "Catalog" is the widest label
  // and 12px puts the fr track 7px over the 359px frame. See THE MEASUREMENT.
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
