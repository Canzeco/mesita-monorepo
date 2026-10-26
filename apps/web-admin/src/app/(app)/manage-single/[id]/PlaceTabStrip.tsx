"use client";

// Every door on one place, one row (MESITA-2086). The strip draws exactly
// the views the layout published (`FIRST_STAGE_TABS`: Profile · Reviews ·
// Preview · Admin · Boost), in `PLACE_TABS` order.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";

type Pill = { key: PlaceTab; href: string; label: string };

/** The granted views in matrix order (Profile leads it). Exported so a test
 *  can pin that every pill has a page.tsx. */
export function stripPills(placeId: string, tabs: readonly PlaceTab[]): Pill[] {
  return tabs.map((key) => ({
    key,
    href: placeTabHref(placeId, key),
    label: PLACE_TAB_LABEL[key],
  }));
}

export function PlaceTabStrip({
  placeId,
  tabs,
}: {
  placeId: string;
  tabs: readonly PlaceTab[];
}) {
  const pathname = usePathname();
  const activeTab = placeTabFromPathname(pathname);
  return (
    <nav
      aria-label="Place views"
      className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {stripPills(placeId, tabs).map((pill) => {
        const active = activeTab === pill.key;
        return (
          <Link
            key={pill.key}
            href={pill.href}
            aria-current={active ? "page" : undefined}
            className={
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 type-body font-medium transition " +
              (active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
            }
          >
            {pill.label}
          </Link>
        );
      })}
    </nav>
  );
}
