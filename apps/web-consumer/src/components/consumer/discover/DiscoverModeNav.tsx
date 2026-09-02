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
// THE MEASUREMENT, and it is tight. `auto-cols-fr` sizes EVERY column to the
// widest pill, so the track is 5 x widest + 16px of gaps and it must fit 359px:
//
//   label      text    + 26px chrome   track (5w+16)   vs 359px
//   ---------  ------  --------------  --------------  ----------
//   Search     40.0    66.0            346.0           fits (+13)
//   Catalog    44.0    70.0            366.0           SCROLLS (-7)
//   Favorites  59.4    85.4            443.0           SCROLLS (-84)
//
// Measured with real Inter 600 at 12px, not estimated. Chrome per pill = 14px
// icon + 4px gap-1 + 8px px-1. That is why "Favorites" is "Favs", why this row
// went from seven modes to five (at seven the columns are 47.9px and nothing
// with an icon fits), and why the browse mode is "Home" (59.3) rather than
// "Catalog" or "Browse" — both of those overflow.
//
// A SIXTH mode, or any label wider than "Search", puts it back over budget.
// Re-measure at 375px before adding either. If a wider word is worth it, the
// escape is `type-label` (0.6875rem, globals.css) on the pill, NOT a
// `text-[11px]` arbitrary value — eslint's off-scale-font-size rule bans those
// and names the role tokens as the sanctioned way down.
//

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Heart,
  LayoutGrid,
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
// SEARCH IS THE MAP, and it carries the search bar. A found place needs
// somewhere to land, and on a list it lands nowhere — so the typed control sits
// on the pins. FEED is the catalog rails with that bar removed: browsing and
// typing are different jobs, and two inputs one pill apart was the redundancy
// this row is fixing.
//
// HOME LEADS BUT SEARCH IS THE DEFAULT (see `discoverDefault`), so the first
// pill is not the landing screen. That reads like a bug until you know it is a
// call, which is why route-structure pins it.
//
// ORDER runs from the least to the most committed way to browse: rails you
// scan, a name you type, a deck you flick, a question you ask, a list you
// already curated.
export const MODES: Mode[] = [
  { href: CONSUMER_ROUTES.discoverTabs.home, label: "Home", Icon: LayoutGrid },
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
