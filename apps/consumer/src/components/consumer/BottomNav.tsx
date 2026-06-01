"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Bookmark, QrCode, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Four top-level surfaces, all styled identically: muted at rest, pink
// only when selected. The active tab gets a top pill indicator + a soft
// pink ring-fill behind its icon + a text-primary label, so the current
// surface is unmistakable at a glance without any tab drawing color
// while idle.
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
  },
  { href: "/profile", Icon: User, label: "Me", match: "/profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-card/95 z-40 shrink-0 border-t px-1 pt-2 backdrop-blur">
      <div className="flex items-end justify-around">
        {ITEMS.map(({ href, Icon, label, match }) => {
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
                  consistent. The active tab gets a soft pink ring-fill
                  hugging the icon; idle tabs stay neutral. The icon
                  color is inherited from the Link (text-primary when
                  active, muted otherwise). */}
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary/10 ring-primary/20 ring-1",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
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
