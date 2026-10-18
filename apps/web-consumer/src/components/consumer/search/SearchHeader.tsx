"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape):
//
//   ( ⌖ ) [ ⚲ Search places by name…     ] ( ✦ Ask AI )   ┐ a white band,
//   (⚙) (All) (☕ Coffee) (🥐 Breakfast) (🍕 Pizza) …     ┘ hairline under
//   ─────────────────── map ───────────────────────────
//   [ the bar's results, over the map's top edge ]
//
// The bar's row: the locate disc, the query bar, Ask AI (→ Search › Chat,
// Soon). Under it one horizontal chip row: the Filters disc (the sheet:
// Families + Google Reviews), All, then every family. ONE family at a time,
// or All (Pato, MESITA-2412) — the same server-side `familyKeys` the sheet
// sets, so the two always agree.
//
// A WHITE BAND, like Home's header and the bottom bar (Pato, MESITA-2413:
// "return to the white background" — it floated for MESITA-2412). Every
// control is h-11: the disc, the bar, Ask AI, the Filters disc and every
// chip. `children` (the bar's results, the load error) hang from the band's
// bottom edge over the map (`absolute top-full`).

import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { clearMapFamilies, selectMapFamily, useMapFilters } from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { SearchFilterRow } from "./SearchFilterRow";

const CHIP =
  "flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition active:scale-[0.97]";
const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-border bg-card text-foreground hover:bg-muted";

export function SearchHeader({
  locate,
  bar,
  filterCount,
  onOpenFilters,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the two buttons leave. */
  bar: ReactNode;
  filterCount: number;
  onOpenFilters: () => void;
  /** Stacked under the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  return (
    <div
      className="border-border bg-card/95 relative z-30 shrink-0 border-b backdrop-blur"
      data-search-header
    >
      <div className="flex min-w-0 items-center gap-2 px-2 pt-2.5 pb-2">
        {locate}
        <div className="min-w-0 flex-1">{bar}</div>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          className="border-border bg-card text-foreground hover:bg-muted flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.97]"
          data-search-ask-ai
        >
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>Ask AI</span>
        </Link>
      </div>
      <nav
        aria-label="Families"
        className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto overscroll-x-contain px-2 pb-2.5"
        data-search-chips
      >
        <SearchFilterRow variant="chip" count={filterCount} onOpenFilters={onOpenFilters} />
        <button
          type="button"
          onClick={clearMapFamilies}
          aria-pressed={filters.familyKeys.length === 0}
          className={cn(CHIP, filters.familyKeys.length === 0 ? CHIP_ON : CHIP_OFF)}
        >
          All
        </button>
        {FILTERABLE_PLACE_FAMILIES.map((family) => {
          const on = filters.familyKeys.length === 1 && filters.familyKeys[0] === family.key;
          return (
            <button
              key={family.key}
              type="button"
              onClick={() => selectMapFamily(family.key)}
              aria-pressed={on}
              className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
            >
              <span aria-hidden>{family.emoji}</span>
              <span>{family.label}</span>
            </button>
          );
        })}
      </nav>
      {children ? (
        <div className="absolute inset-x-3 top-full mt-3 flex flex-col gap-2">{children}</div>
      ) : null}
    </div>
  );
}
