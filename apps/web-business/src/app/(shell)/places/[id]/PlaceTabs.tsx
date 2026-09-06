"use client";

// The place tab row — the TopNav pill idiom one level down (autoplan D6):
// calm text pills, no icons, no accent color, second row under the title.
// Which tabs exist comes from the layout's matrix; this only renders and
// highlights.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PLACE_TAB_LABEL,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-view";
import { cn } from "@/lib/utils";

export function PlaceTabs({
  placeId,
  tabs,
}: {
  placeId: string;
  tabs: PlaceTab[];
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Place sections">
      {tabs.map((tab) => {
        const href = placeTabHref(placeId, tab);
        const active =
          tab === "overview"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-medium transition",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PLACE_TAB_LABEL[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
