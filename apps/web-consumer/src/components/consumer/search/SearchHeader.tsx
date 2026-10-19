"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape):
//
//   ( ⌖ ) [ ⚲ Search places by name…     ] ( ✦ Ask AI )   ┐ a white band,
//   (⭐ All) (☕ Coffee) (🥐 Breakfast) (🍕 Pizza) …        ┘ hairline under
//   ─────────────────── map ───────────────────────────
//
// The bar's row: the locate disc, the query bar, Ask AI (→ Search › Chat,
// Soon). Under it one horizontal chip row: All, then every family, each
// with its emoji. ONE family at a time, or All (Pato, MESITA-2412), sent as
// the server-side `familyKeys`. There is no Filters disc and no sheet (Pato,
// MESITA-2417: "Its just all and thats it"); the Google reviews minimum is
// the operator's, Admin › Discovery › Area.
//
// A WHITE BAND, like Home's header and the bottom bar (Pato, MESITA-2413:
// "return to the white background" — it floated for MESITA-2412). Every
// control is h-11: the disc, the bar, Ask AI and every chip. `children`
// (the bar's results, the load error) COVER the chip row and run on over the
// map (`absolute top-0` on the chips' box; Pato, MESITA-2417: "the searchbar
// results must cover the categories").

import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

const CHIP =
  "flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition active:scale-[0.97]";
const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-border bg-card text-foreground hover:bg-muted";
/** All wears an emoji like every family chip (Pato, MESITA-2417); a star,
 *  not the globe (Pato, MESITA-2422: "maybe use a star or something"). */
export const ALL_EMOJI = "⭐";

export function SearchHeader({
  locate,
  bar,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the two buttons leave. */
  bar: ReactNode;
  /** Over the chips: the bar's results, the load error. */
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
          <Sparkles
            className="h-4 w-4 shrink-0"
            strokeWidth={2.25}
            aria-hidden
          />
          <span>Ask AI</span>
        </Link>
      </div>
      <div className="relative">
        <nav
          aria-label="Families"
          className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto overscroll-x-contain px-2 pb-2.5"
          data-search-chips
        >
          <button
            type="button"
            onClick={clearMapFamilies}
            aria-pressed={filters.familyKeys.length === 0}
            className={cn(
              CHIP,
              filters.familyKeys.length === 0 ? CHIP_ON : CHIP_OFF,
            )}
          >
            <span aria-hidden>{ALL_EMOJI}</span>
            <span>All</span>
          </button>
          {FILTERABLE_PLACE_FAMILIES.map((family) => {
            const on =
              filters.familyKeys.length === 1 &&
              filters.familyKeys[0] === family.key;
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
          <div
            className="absolute inset-x-2 top-0 z-10 flex flex-col gap-2"
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
