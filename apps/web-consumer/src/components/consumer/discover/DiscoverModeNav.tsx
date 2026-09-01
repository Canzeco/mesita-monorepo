"use client";

// Discover mode rail — the topbar menu across Discover's five modes.
//
// CONTENT-WIDTH PILLS THAT SCROLL, not equal columns. Every other row
// (InboxSectionNav, and HomeModeNav before it) uses `grid-flow-col
// auto-cols-fr`, where the widest label sizes every column.
//
// This shipped at SEVEN modes, where equal columns were arithmetically
// impossible: 359px content − 6 gaps×4px = 335px ÷ 7 = 47.9px per column,
// minus 26px chrome (14px icon + 4px gap + 8px px-1), leaving 21.9px of text
// ≈ 3 characters. "Favorites" is nine.
//
// At FIVE it is no longer impossible, only unsafe. 5 columns give 68.6px each;
// the widest label, "Search", needs about 68px. That is 0.6px of margin, well
// inside the ±3px error on the 0.58em advance this arithmetic uses — a font
// swap or a longer label breaks it silently, and a row that clips mid-word
// reads as a broken render rather than a control. So the rail stays. If the
// segmented look is ever wanted back, shortening one label (Search -> Find,
// 54px) buys real headroom; do that first, do not just switch the class.
//
// THE AMENDED RULE (web-consumer/CLAUDE.md): equal columns when they fit, a
// content-width scrolling rail when they do not. Activity keeps equal columns —
// its four pills fit at 375px with 11px to spare, so converting it would trade
// a working control for consistency alone.
//
// EVERYTHING FITS AT FIVE. Measured track is ~292px against 359px of screen,
// so no pill is off-screen at rest and the scroll is a fallback rather than a
// requirement. That was not true at seven, where Social and Favorites never
// rendered. Adding a sixth mode brings the off-screen problem back — measure
// before adding one, and put live modes first when you do.
//
// Parked pills render at 55% opacity so the ladder reads as a preview rather
// than a broken menu. Three dead pills beside two live ones needs the contrast;
// at seven it was five dead beside two and the row read as broken.

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

// ORDER IS LOAD-BEARING — see the header. Live modes lead so the two that work
// are the two a guest sees without scrolling.
//
// SEARCH absorbs what were Name, Catalog and Social (Pato, 2026-09-01): one
// surface for finding a place that is not already on your screen. The name bar
// is live; CatalogRails and SocialFeed mount into the same page when they
// un-park, rather than getting their pills back.
export const MODES: Mode[] = [
  { href: CONSUMER_ROUTES.discoverTabs.map, label: "Map", Icon: MapPin },
  { href: CONSUMER_ROUTES.discoverTabs.search, label: "Search", Icon: Search },
  {
    href: CONSUMER_ROUTES.discoverTabs.swipe,
    label: "Swipe",
    Icon: Flame,
    soon: true,
    blurb: "A photo-first deck of places near you. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.chat,
    label: "Chat",
    Icon: Sparkles,
    soon: true,
    blurb: "Talk to Don Memo about where to go. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.favs,
    label: "Favs",
    Icon: Heart,
    soon: true,
    blurb: "The places you save, in one grid. Landing here soon.",
  },
];

export function DiscoverModeNav() {
  const pathname = usePathname();
  const [soonMode, setSoonMode] = useState<Mode | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // A rail that scrolls can open with the active pill off-screen — arriving at
  // a mode and not seeing which one is selected is the failure this prevents.
  // `nearest` so it never scrolls when the pill is already visible.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  const base =
    "flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]";
  const resting =
    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";
  const active = "bg-primary text-primary-foreground shadow-glow";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="flex w-max items-center gap-1">
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
