"use client";

// Home mode nav — the sticky pill row that switches between the four Home
// sub-routes. Real <Link> navigation between siblings under the shared /home
// layout, so the fetched deck (HomeDeckBoundary) is reused, not re-fetched.
// The shell renders no TopBar for /home, so this band IS the page's top chrome.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, Heart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// `soon` tabs aren't navigable yet — tapping opens a "coming soon" dialog
// instead of routing (their routes still redirect to swipe, so direct URLs
// can't reach the parked content). Kept visible + tappable so the surface
// reads as intentional; un-parking is `soon: false` + restoring the page.
// ("Memo" = the Ask AI concierge.)
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
    href: CONSUMER_ROUTES.homeTabs.ai,
    label: "Memo",
    Icon: Sparkles,
    soon: true,
    blurb:
      "Don Memo, your AI concierge, is almost ready — tell him the vibe you want and he'll find your spot.",
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
    "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition active:scale-[0.98]";

  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
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
                <Icon className="h-4 w-4" strokeWidth={2.2} />
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
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <LocalDialog
        open={soonTab != null}
        onClose={() => setSoonTab(null)}
        ariaLabel={soonTab ? `${soonTab.label} — coming soon` : "Coming soon"}
      >
        {soonTab && <ComingSoon tab={soonTab} onClose={() => setSoonTab(null)} />}
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
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {label}
      </h2>
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
