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
// Only Swipe and Favorites are FUNCTIONAL (Pato, 2026-08-16). Catalog, Chat
// and Social are parked — all three keep working code on disk, so each is a
// one-flag unpark, and all five pills stay visible so the row reads as the
// finished shape rather than a surface still being assembled.

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
// reads as intentional; un-parking is `soon: false` + restoring the page.
//
// The AI mode's pill reads "Memo" again (MESITA-1102). It was renamed to
// "Chat" on 2026-08-16 so the label would name what the mode DOES — sound
// reasoning that stopped holding the moment the mode grew a second way in.
// Memo now offers Call AND Chat, so "Chat" names half of it, and the only
// honest label for a mode containing both is the concierge himself.
//
// The ROUTE stays /home/chat. Renaming it would add a third path for one
// surface (/home/ai already 308s to it) and the contract is drift-guarded
// against the mobile copy plus pinned by route-structure.test.tsx — a lot of
// moving parts to buy a URL nobody sees. Label ≠ route is already the
// convention here.
type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon?: boolean;
  blurb?: string;
};

const TABS: Tab[] = [
  { href: CONSUMER_ROUTES.homeTabs.swipe, label: "Swipe", Icon: Flame },
  {
    href: CONSUMER_ROUTES.homeTabs.catalog,
    label: "Catalog",
    Icon: LayoutGrid,
    // RE-PARKED 2026-08-16 (Pato: "only functional must be swipe and
    // favorites"). The grid itself is built and works — CatalogGrid stays on
    // disk for a one-flag unpark, same convention as AskAiTab/SocialTab.
    soon: true,
    blurb:
      "The full Mesita catalog — every place, browsable and filterable, without swiping. Coming soon.",
  },
  {
    href: CONSUMER_ROUTES.homeTabs.chat,
    label: "Memo",
    Icon: Sparkles,
    soon: true,
    blurb:
      "Don Memo, your AI concierge, is almost ready — call him or chat with him, tell him the vibe you want, and he'll find your spot.",
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

  const baseClass =
    "flex items-center justify-center gap-1 rounded-full px-1 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98]";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="scrollbar-hide overflow-x-auto px-2 py-2.5">
        <div className="grid w-max min-w-full grid-flow-col auto-cols-fr items-center gap-1">
          {TABS.map((tab) => {
            const { href, label, Icon, soon } = tab;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            if (soon) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => setSoonTab(tab)}
                  className={cn(
                    baseClass,
                    "text-muted-foreground hover:text-foreground",
                  )}
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
                    : "text-muted-foreground hover:text-foreground",
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
      <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase">
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
