"use client";

// Discover mode rail — the topbar menu across Discover's seven modes.
//
// CONTENT-WIDTH PILLS THAT SCROLL, not equal columns, and this is the one
// section nav in the app that works that way. Every other row (InboxSectionNav,
// and HomeModeNav before it) uses `grid-flow-col auto-cols-fr`, where the
// widest label sizes every column. That rule holds up to five modes. It cannot
// hold seven:
//
//   359px content − 6 gaps×4px = 335px ÷ 7 = 47.9px per column
//   − 26px chrome (14px icon + 4px gap + 8px px-1)
//   = 21.9px of text ≈ 3 characters at Inter 600 12px
//
// "Favorites" is nine. Seven equal pills is not tight, it is arithmetically
// impossible, so the row changes shape instead of shrinking. Mobile's
// SegmentNav already diverged to content-width pills for exactly this reason —
// this converges on that rather than inventing a third look.
//
// THE AMENDED RULE (web-consumer/CLAUDE.md): equal columns when they fit, a
// content-width scrolling rail when they do not. Activity keeps equal columns —
// its four pills fit at 375px with 11px to spare, so converting it would trade
// a working control for consistency alone.
//
// TWO PILLS DO NOT RENDER AT REST. Measured track is ~472px against 359px of
// screen, so Social and Favorites sit off-screen until the guest scrolls.
// Tolerable while both are parked. NOT tolerable the day Favorites un-parks,
// because saved places is the mode a returning guest actively hunts for.
// Re-order BEFORE un-parking it, not after.
//
// Parked pills render at 55% opacity so the ladder reads as a preview rather
// than a broken menu — five identical-looking dead pills next to two live ones
// is worse at seven scrolling than it was at five equal.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  Heart,
  LayoutGrid,
  MapPin,
  Search,
  Sparkles,
  Users,
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
// NAME, not "Search": the mode searches Mesita place NAMES, which is what
// `consumer-web-suggest-places` actually does. It also costs 4 characters
// against Search's 6, worth 14px on a rail that already overflows by ~113px.
export const MODES: Mode[] = [
  { href: CONSUMER_ROUTES.discoverTabs.map, label: "Map", Icon: MapPin },
  { href: CONSUMER_ROUTES.discoverTabs.name, label: "Name", Icon: Search },
  {
    href: CONSUMER_ROUTES.discoverTabs.swipe,
    label: "Swipe",
    Icon: Flame,
    soon: true,
    blurb: "A photo-first deck of places near you. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.catalog,
    label: "Catalog",
    Icon: LayoutGrid,
    soon: true,
    blurb: "Stacked rails of places to browse. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.chat,
    label: "Chat",
    Icon: Sparkles,
    soon: true,
    blurb: "Talk to Don Memo about where to go. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.social,
    label: "Social",
    Icon: Users,
    soon: true,
    blurb:
      "See where your friends are going and share the places you love. Landing here soon.",
  },
  {
    href: CONSUMER_ROUTES.discoverTabs.favorites,
    label: "Favorites",
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
