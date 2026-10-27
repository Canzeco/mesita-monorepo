"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape), ONE row since
// MESITA-2875:
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ☷ ) ( ✦ Ask AI )   one white band
//   ─────────────────── map ───────────────────────────
//
// The locate disc, the query bar, the Filters disc, the Ask AI pill (→ Search
// › Chat). One token set for every control lives in header-classes.ts.
// NO CHIP ROW (Pato, MESITA-2875: "remove the categories bar its going to be
// hidden now"): the family pick lives behind the Filters disc, in
// SearchFiltersSheet (Top and every family; MESITA-2758). The disc is the icon
// alone (MESITA-2761) and LIGHTS while a family is picked, so a hidden filter
// is never invisible. NO NEARBY, NO POPULAR (MESITA-2499/2502): the map is the
// where, a family is only the what. The Minimum Popularity stays the
// operator's, Admin › Discovery › Area.
//
// A SOLID WHITE BAND, like Home's header and the bottom bar (Pato,
// MESITA-2413, MESITA-2462: "i don't like a transparent scrolling at all");
// the controls are grey fills, so white-on-white (MESITA-2450) cannot happen.
// Every control is h-9 (MESITA-2445). `children` (the bar's results, the load
// error) hang just under the band and run on over the map.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BotMessageSquare, SlidersHorizontal } from "lucide-react";
import { useMapFilters } from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { CHIP_ON, HEADER_DISC, HEADER_PILL } from "./header-classes";
import { SearchFiltersSheet } from "./SearchFiltersSheet";

export function SearchHeader({
  locate,
  bar,
  children,
}: {
  /** The locate disc, at the left of the row. */
  locate: ReactNode;
  /** The query bar; it takes what the discs leave. */
  bar: ReactNode;
  /** Under the band: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const familyPicked = filters.familyKeys.length > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div
      className="border-border bg-card relative z-30 shrink-0 border-b"
      data-search-header
      data-search-band
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        {locate}
        <div className="min-w-0 flex-1">{bar}</div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
          aria-label="Filters"
          className={cn(
            HEADER_DISC,
            familyPicked && [CHIP_ON, "hover:bg-primary"],
          )}
          data-search-filters
        >
          <SlidersHorizontal
            className="h-4 w-4 shrink-0"
            strokeWidth={familyPicked ? 2.25 : 1.75}
            aria-hidden
          />
        </button>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          className={HEADER_PILL}
          data-search-ask-ai
        >
          <BotMessageSquare
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          <span>Ask AI</span>
        </Link>
      </div>
      {children ? (
        <div className="relative">
          <div
            className="absolute inset-x-3 top-0 z-10 flex flex-col gap-2 pt-2"
            data-search-under-band
          >
            {children}
          </div>
        </div>
      ) : null}
      <SearchFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
