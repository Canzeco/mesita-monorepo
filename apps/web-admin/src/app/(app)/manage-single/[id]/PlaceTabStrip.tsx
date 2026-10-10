"use client";

// Every door on one place, one row (MESITA-2086). The business console draws
// only Place · Setup · Activity as rail rows and reaches the product views
// from Setup's cards (Pato's four destinations, MESITA-1974); the admin
// console is the operator's cockpit and lights every view the matrix grants,
// in `PLACE_TABS` order with the two PAGES after Profile — so the strip and
// the gate read the same list and an address the gate would 404 never gets
// a pill.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PLACE_PAGE_LABEL,
  PLACE_PAGES,
  placePageFromPathname,
  placePageHref,
  type PlacePage,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";

type Pill =
  | { kind: "tab"; key: PlaceTab; href: string; label: string }
  | { kind: "page"; key: PlacePage; href: string; label: string };

/** Profile first, then the two pages, then the rest of the granted views in
 *  matrix order. Exported so a test can pin that every pill has a page.tsx. */
export function stripPills(placeId: string, tabs: readonly PlaceTab[]): Pill[] {
  const tab = (key: PlaceTab): Pill => ({
    kind: "tab",
    key,
    href: placeTabHref(placeId, key),
    label: PLACE_TAB_LABEL[key],
  });
  const pages: Pill[] = PLACE_PAGES.map((key) => ({
    kind: "page",
    key,
    href: placePageHref(placeId, key),
    label: PLACE_PAGE_LABEL[key],
  }));
  const views = tabs.filter((t) => t !== "profile");
  return [
    ...(tabs.includes("profile") ? [tab("profile")] : []),
    ...pages,
    ...views.map(tab),
  ];
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
  const activePage = placePageFromPathname(pathname);
  return (
    <nav
      aria-label="Place views"
      className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {stripPills(placeId, tabs).map((pill) => {
        const active =
          pill.kind === "tab" ? activeTab === pill.key : activePage === pill.key;
        return (
          <Link
            key={`${pill.kind}-${pill.key}`}
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
