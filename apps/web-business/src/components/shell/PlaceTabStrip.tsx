"use client";

// Every view of one place, one row (MESITA-3103).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLACE_TAB_LABEL, placeTabFromPathname, placeTabHref, type PlaceTab } from "@/lib/place-tabs";

export function PlaceTabStrip({ placeId, tabs }: { placeId: string; tabs: readonly PlaceTab[] }) {
  const active = placeTabFromPathname(usePathname());
  return (
    <nav aria-label="Place views" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4   ">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={placeTabHref(placeId, tab)}
          aria-current={active === tab ? "page" : undefined}
          className={
            "type-body inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 font-medium transition " +
            (active === tab
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
          }
        >
          {PLACE_TAB_LABEL[tab]}
        </Link>
      ))}
    </nav>
  );
}
