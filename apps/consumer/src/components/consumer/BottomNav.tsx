"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Bookmark, QrCode, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Four top-level surfaces. Pay & Post carries a `primary` flag — its
// icon renders inside a pink-tinted ring-circle even when the tab
// isn't selected so it reads as the lead CTA among the four
// (scan-to-pay + post-a-story are the moments every visit ends at,
// and the surface deserves the extra weight). When the tab IS
// selected, the circle fills with the full pink gradient + glow.
//
// Active state on ANY tab also gets a top pill indicator + ringed
// background on the icon cell so the current surface is unmistakable
// at a glance, not just a color change.
//
// Coupons, Share/Invite were dropped from the bottom row — they now
// live inside Profile (alongside Class + Settings). Saved was promoted
// out of Discover into the bottom row — bookmarking a place is now a
// first-class action, the "Save → coupon" coupling is gone.

type Item = {
  href: string;
  Icon: LucideIcon;
  label: string;
  match: string;
  primary?: boolean;
};

const ITEMS: Item[] = [
  {
    href: "/discover/swipe",
    Icon: Compass,
    label: "Explore",
    match: "/discover",
  },
  {
    // Saved now covers both saved places and reservations (sub-tabs on
    // the Saved page); /reservations stays reachable as a deep link.
    href: "/saved",
    Icon: Bookmark,
    label: "Saved",
    match: "/saved",
  },
  {
    href: "/pay",
    Icon: QrCode,
    label: "Pay",
    match: "/pay",
    primary: true,
  },
  { href: "/profile", Icon: User, label: "Me", match: "/profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-card/95 z-40 shrink-0 border-t px-1 pt-2 backdrop-blur">
      <div className="flex items-end justify-around">
        {ITEMS.map(({ href, Icon, label, match, primary }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Top pill — visible only when the tab is active. Tiny,
                  pink, centered. Gives the active state a graphic
                  marker so it's not just a color shift on the label. */}
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
              )}

              {/* Icon cell. Always 32×32 so the row height stays
                  consistent. Pay gets a pink-tinted ring-fill at rest
                  and a solid pink gradient when active. Other tabs
                  get a soft pink ring when active (only) — the
                  background hugs the icon to telegraph "current tab"
                  without shouting. */}
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition",
                  primary
                    ? active
                      ? "bg-pink-gradient shadow-glow"
                      : "bg-pink-500/15 ring-1 ring-pink-500/25"
                    : active
                      ? "bg-primary/10 ring-primary/20 ring-1"
                      : "",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    primary && active && "text-white",
                    primary && !active && "text-pink-600",
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
