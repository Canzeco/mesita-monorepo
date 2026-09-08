"use client";

// Home's mode rail — the topbar menu across Home's five modes.
//
// SEARCH LEFT THIS RAIL FOR ITS OWN TAB (Pato, MESITA-1609), then its own
// ROUTE (MESITA-1616) — the tab move alone left Search's screen nested under
// this same layout, which kept this rail rendering above the map. Both
// concerns are gone now: Search shares neither this component nor its route
// with Home.
//
// EVERY PILL IS 25% (four modes since MESITA-1697), the same rule
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
// THE MEASUREMENT, re-run for FOUR columns (MESITA-1697). Dropping a column
// changes the arithmetic twice over: the track is `4 x widest + 12` (three
// gaps, not four), and each column is wider because the same frame is split
// four ways instead of five.
//
// "Scroll" is 30.0px at Inter 600 / 11px, derived from this table's own
// advance widths (S 620 + c 552 + r 401 + o 604 + l 274 + l 274 = 2725 units).
// The derivation was validated against three labels this table already
// measured — Feed 25.41 vs 25.4, Chat 24.54 vs 24.5, Swipe 31.68 vs 31.8.
//
//   label    text@12  + 28px chrome   track (4w+12)   vs 359px
//   -------  -------  --------------  --------------  -----------
//   Scroll   32.7     60.7            254.8           fits (+104)
//   Feed     27.7     55.7            234.8           fits (+124)
//   Chat     26.7     54.7            230.8           fits (+128)
//   Favs     27.4     55.4            233.6           fits (+126)
//
// CATALOG WAS THE BINDING CONSTRAINT AND IT IS GONE. Its 347.5-of-359px track
// is what forced this rail down to `type-label` (11px) and what the previous
// version of this block called "no longer a preference". Scroll is the widest
// label now at 254.8px of budget — 104px of margin against Catalog's 11.5 —
// so the constraint is not merely relaxed, it is removed. Solving
// `4(w + 28) + 12 <= 359` gives w <= 58.75px: any label up to roughly 80%
// wider than "Catalog" now fits.
//
// SO THE 11px IS GONE, AND AT FOUR COLUMNS IT WOULD BE A BUG. `auto-cols-fr`
// splits the FULL track regardless of content, so each pill is
// (359 - 12) / 4 = 86.75px wide while holding 16px icon + 4px gap + ~33px
// label = ~53px of content. An 11px label floating in an 87px pill reads as
// an unfinished render. `text-xs` (12px) with a 16px icon keeps the glyph and
// the label in proportion inside a column that is now much wider than either.
//
// A FIFTH MODE would put the track at 4 x 60.7 + 60.7 + 16 = 319.2 and still
// fit. Re-measure anyway — that is the package rule, and it is what caught
// this one.
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
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";
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
// for the next mode that lands unfinished, not because anything uses it today.
//
// FOUR MODES, AND THE LADDER IS THE ORDER (Pato, MESITA-1697). Left to right
// the modes cost the guest progressively more input, and that is the whole
// argument for four of them rather than four ways to browse:
//
//   Scroll   zero input      "show me"          thumb
//   Feed     structured      "narrow it"        taps
//   Chat     freeform        "describe it"      types
//   Favs     recall          "what did I keep"  returns
//
// SCROLL LEADS AND IS THE DEFAULT, inheriting that from Swipe rather than
// re-arguing it: first-pill-is-default is the property this rail preserves
// (see consumer-route-contract.ts's discoverDefault note), and Scroll is the
// mode that answers "what is there" with no input at all.
//
// FEED IS THE CATALOG RAILS NOW, with a filter control above them — it
// absorbed Catalog's body at MESITA-1697. It keeps LayoutGrid, which came
// with that body: the four boxes read as sections, which is what rails are.
// Rows3 left with the two-column grid this mode used to be.
//
// LayoutGrid, not House. #1449 swapped the grid for a house because the grid
// "read as four boxes next to the word Home" — correct then, and the same
// reasoning still holds in reverse: rails of category tiles ARE a grid, and
// the word beside it is Feed, not Home.
//
// Flame stays on Scroll. It marked Swipe, it marks the Home tab in BottomNav,
// and the mode underneath is the same deck of places — a new glyph would
// claim a change that did not happen.
export const MODES: Mode[] = [
  {
    href: CONSUMER_ROUTES.discoverTabs.scroll,
    label: "Scroll",
    Icon: Flame,
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.feed,
    label: "Feed",
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
  const supabase = useBrowserSupabase();
  const [soonMode, setSoonMode] = useState<Mode | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Only bites when large accessibility text pushes the track past the frame
  // and the scroller takes over. `nearest` makes it a no-op at rest, which is
  // the normal case — the columns fit.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  // `text-xs` (12px), restored at MESITA-1697. "Catalog" was what forced 11px
  // and Catalog is gone; at four columns each pill is ~87px wide and an 11px
  // label inside one reads as an unfinished render. See THE MEASUREMENT.
  const base =
    "text-xs flex items-center justify-center gap-1 rounded-full px-1 py-2 font-semibold whitespace-nowrap transition active:scale-[0.98]";
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
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
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
                // The switch itself, not the landing — `nav_tab_tap` fires on
                // BottomNav only, so before this every in-Home mode change was
                // invisible and six rail restructures shipped without one
                // number between them.
                onClick={() => {
                  if (!isActive) trackEvent(supabase, "home_mode_view", { mode: label });
                }}
                className={cn(base, isActive ? active : resting)}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
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
