"use client";

// Home mode nav — the sticky pill row that switches between the four Home
// sub-routes. Real <Link> navigation between siblings under the shared /home
// layout, so the fetched deck (HomeDeckBoundary) is reused, not re-fetched.
// The shell renders no TopBar for /home, so this band IS the page's top chrome.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Heart, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// `soon` tabs are BLOCKED, not removed: kept visible (so the surface reads as
// intentional and un-parking is a one-flag flip) but disabled and non-navigable
// while we finish the others first. Their routes also redirect to swipe (see
// home/social/page.tsx) so direct URLs can't reach the parked content. Flip
// `soon: false` + restore that page to unblock. ("Memo" = the Ask AI concierge.)
const TABS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon?: boolean;
}[] = [
  { href: CONSUMER_ROUTES.homeTabs.swipe, label: "Swipe", Icon: Flame },
  { href: CONSUMER_ROUTES.homeTabs.ai, label: "Memo", Icon: Sparkles, soon: true },
  {
    href: CONSUMER_ROUTES.homeTabs.social,
    label: "Social",
    Icon: Users,
    soon: true,
  },
  { href: CONSUMER_ROUTES.homeTabs.favorites, label: "Favorites", Icon: Heart },
];

export function HomeModeNav() {
  const pathname = usePathname();
  return (
    <div className="border-border bg-background/90 sticky top-0 z-20 shrink-0 border-b backdrop-blur-xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        {TABS.map(({ href, label, Icon, soon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const baseClass =
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition";

          if (soon) {
            return (
              <span
                key={href}
                aria-disabled="true"
                title="Coming soon"
                className={cn(
                  baseClass,
                  "text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                <span>{label}</span>
                <span className="border-border/70 text-muted-foreground/70 rounded-full border px-1 py-0.5 text-[8px] font-semibold tracking-[0.12em] uppercase">
                  Soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                baseClass,
                "active:scale-[0.98]",
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
    </div>
  );
}
