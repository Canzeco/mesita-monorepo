"use client";

// Discover mode rail — the topbar menu across Discover's five modes.
//
// EVERY PILL IS 20% (Pato, 2026-09-01), the same rule InboxSectionNav follows
// at 25% and HomeModeNav followed at 20% before it. The two section rows are
// one control and they size the same way, so this file is back in line with
// them: `grid-flow-col auto-cols-fr` on a `w-max min-w-full` track. At rest
// min-w-full stretches the track to the frame and the fr columns split it into
// exact fifths; at large accessibility text w-max lets the track outgrow the
// frame and the scroller takes over, columns still equal.
//
// THE SCROLLER IS THE FALLBACK, NOT THE RESTING STATE. A row that scrolls at
// rest clips a label mid-word and reads as a broken render rather than an
// affordance.
//
// THE MEASUREMENT, and it is tight. Equal columns are budgeted by the LONGEST
// label, not the average:
//
//   frame   content   gaps   cols   each     widest pill needs      result
//   ------  --------  -----  -----  -------  ---------------------  --------
//   375px   359px     16px   5      68.6px   "Search"   ~68px       fits (+0.6)
//   375px   359px     16px   5      68.6px   "Favorites" ~89px      WOULD NOT
//
// Budget per pill = text + 14px icon + 4px gap + 8px px-1. That +0.6px is why
// "Favorites" is "Favs" and why this row went from seven modes to five: at
// seven the columns are 47.9px and nothing with an icon fits. A SIXTH mode, or
// a label longer than "Search", puts it back over budget — re-measure at 375px,
// not at the 448px card, before adding either.
//

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Heart,
  MapPin,
  Search,
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

// ALL FIVE ARE LIVE (Pato, 2026-09-01). Nothing here is parked any more, so
// the row is five real destinations rather than a preview ladder: the `soon`
// branch below is kept for the next mode that lands unfinished, not because
// anything uses it today.
//
// SEARCH absorbs what were Name, Catalog and Social: one surface for finding a
// place that is not already on your screen. The name bar sits over the catalog
// feed on the same page.
//
// ORDER runs from the least to the most committed way to browse: a map you
// scan, a name you type, a deck you flick, a question you ask, a list you
// already curated.
export const MODES: Mode[] = [
  { href: CONSUMER_ROUTES.discoverTabs.map, label: "Map", Icon: MapPin },
  { href: CONSUMER_ROUTES.discoverTabs.search, label: "Search", Icon: Search },
  {
    href: CONSUMER_ROUTES.discoverTabs.swipe,
    label: "Swipe",
    Icon: Flame,
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

  const base =
    "flex items-center justify-center gap-1 rounded-full px-1 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]";
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
