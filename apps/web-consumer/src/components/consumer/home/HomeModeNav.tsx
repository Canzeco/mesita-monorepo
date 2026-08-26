"use client";

// Home mode nav — the sticky pill row that switches between the five Home
// sub-routes. Real <Link> navigation between siblings under the shared /home
// layout, so the fetched deck (HomeDeckBoundary) is reused, not re-fetched.
// The shell renders no TopBar for /home, so this band IS the page's top chrome.
//
// EVERY PILL IS 20% (Pato, 2026-08-17), the same rule InboxSectionNav follows
// at 25% — the two section rows are one control, so they size the same way.
// `grid-flow-col auto-cols-fr` on a `w-max min-w-full` track: at rest
// min-w-full stretches the track to the frame and the fr columns split it into
// exact fifths; at large accessibility text w-max lets the track outgrow the
// frame and the scroller takes over, columns still equal (all sized to the
// widest, "Favorites"). The scroller stays the FALLBACK, not the resting
// state — a row that scrolls at rest clips "Favorites" mid-word and reads as
// a broken render rather than an affordance.
//
// Equal columns are budgeted by the LONGEST label, not the average, so this is
// the tighter of the two rows: a fifth of the 432px content box is 83px and
// "Favorites" spends 78 of it (Inter 600 12px ≈ 52px + 14px icon + gap +
// px-1). Hence px-1 pills and 14px icons — px-1.5 leaves under a pixel and
// px-2 overflows. A sixth mode, or a label longer than "Favorites", puts it
// back over budget: measure before adding either.
//
// Swipe · Catalog · Chat · Favorites are FUNCTIONAL (Pato, 2026-08-26).
// Social stays parked — working code on disk, one-flag unpark. All five
// pills stay visible so the row reads as the finished shape.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Flame,
  Heart,
  LayoutGrid,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// `soon` tabs aren't navigable yet — tapping opens a "coming soon" dialog
// instead of routing (their routes still redirect to swipe, so direct URLs
// can't reach the parked content). Kept visible + tappable so the surface
// reads as intentional; un-parking is dropping `soon` + restoring the page.
//
// The AI mode's pill reads "Chat" (Pato, 2026-08-21). The label names the one
// thing a guest can actually DO in the mode: Call is announced-only — no Memo
// voice agent exists — so Chat is the only segment in MemoModeHeader that ever
// wins the selected state. The concierge's NAME is Don Memo and it stays on
// the header inside the mode; the pill names the surface, not the persona.
//
// Label and route agree (/home/chat), as do the admin console's Discover
// config tabs. The route was never the thing that moved — renaming it would
// add a third path for one surface (/home/ai already 308s to it) and it is
// drift-guarded against the mobile copy plus pinned by route-structure.test.tsx.
type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon?: boolean;
  blurb?: string;
};

const TABS: Tab[] = [
  { href: CONSUMER_ROUTES.homeTabs.swipe, label: "Swipe", Icon: Flame },
  { href: CONSUMER_ROUTES.homeTabs.catalog, label: "Catalog", Icon: LayoutGrid },
  {
    href: CONSUMER_ROUTES.homeTabs.chat,
    label: "Chat",
    Icon: Sparkles,
  },
  {
    href: CONSUMER_ROUTES.homeTabs.social,
    label: "Social",
    Icon: Users,
    soon: true,
    blurb:
      "See where your friends are going and share the places you love. Landing here soon.",
  },
  { href: CONSUMER_ROUTES.homeTabs.favorites, label: "Favorites", Icon: Heart },
];

export function HomeModeNav() {
  const pathname = usePathname();
  const [soonTab, setSoonTab] = useState<Tab | null>(null);

  // EVERY PILL CARRIES A SURFACE (fixed 2026-08-20) — the same change landed
  // on InboxSectionNav in the same pass, because the two rows are one control
  // and must not drift. Rationale in full lives in that file's header; short
  // version: exact equal columns still read as ragged when only the active
  // pill is drawn, since the eye groups on text edges and the column edges are
  // invisible. Drawing the resting surface makes the perceived rhythm the pill
  // edges (five equal fifths, uniform gap-1) instead of the words. Zero width
  // cost, so the px-1 budget documented above is untouched.
  const baseClass =
    "flex items-center justify-center gap-1 rounded-full px-1 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]";
  const restingClass =
    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full auto-cols-fr grid-flow-col items-center gap-1">
          {TABS.map((tab) => {
            const { href, label, Icon, soon } = tab;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setSoonTab(tab)}
                  className={cn(baseClass, restingClass)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span>{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  baseClass,
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : restingClass,
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <LocalDialog
        open={soonTab != null}
        onClose={() => setSoonTab(null)}
        ariaLabel={soonTab ? `${soonTab.label} — coming soon` : "Coming soon"}
      >
        {soonTab && (
          <ComingSoon tab={soonTab} onClose={() => setSoonTab(null)} />
        )}
      </LocalDialog>
    </div>
  );
}

// Coming-soon dialog body — tinted icon, badge, per-tab blurb, dismiss.
function ComingSoon({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const { Icon, label, blurb } = tab;
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
