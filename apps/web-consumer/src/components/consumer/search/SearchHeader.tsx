"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape). MESITA-2879 puts
// back the MESITA-2875 chip row and the three-control bar row ("Location |
// Searchbar | Ask AI / Families Carousel as in the past"):
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ Ask AI )   one white band …
//   ─────────────────── hairline ──────────────────────
//   (▦ All) (○ Coffee) (○ Breakfast) (○ Quick) …   … one hairline under
//   ─────────────────── map ───────────────────────────
//
// The bar's row: the locate disc, the query bar, the Ask AI pill (→ Search ›
// Chat). One token set for every control lives in header-classes.ts. NO ADD
// DISC (MESITA-2876's `+`), and no Add card since MESITA-2883: the bar
// searches Mesita names only, so it cannot add a Google place. NO FILTERS (MESITA-2758's disc and sheet): the chip row
// is the family pick. Under the bar's row one horizontal chip row: All, then
// every family, each with its line icon (MESITA-2478: line icons, not emoji).
// All, not Top (Pato's word, MESITA-2879; MESITA-2534 had Top). NO NEARBY,
// NO POPULAR (MESITA-2499/2502): the map is the where, a chip is only the
// what. ONE pick at a time: All is lit when no family is; tapping the lit
// family again also goes back to All. Sent as the server-side `familyKeys`.
// The Minimum Popularity stays the operator's, Admin › Discovery › Area.
//
// ONE SOLID WHITE BAND for both rows, like Home's header and the bottom bar
// (Pato, MESITA-2413, MESITA-2469; MESITA-2462: "i don't like a transparent
// scrolling at all"); the controls are grey fills, so white-on-white
// (MESITA-2450) cannot happen. Every control is h-9 (MESITA-2445).
// `children` (the bar's results, the load error) COVER the chip row and run
// on over the map (MESITA-2417); while the bar queries the chip row is not
// drawn at all (MESITA-2487).

import type { ReactNode } from "react";
import Link from "next/link";
import { BotMessageSquare } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { FamilyIcon } from "@/lib/family-icons";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_OFF, CHIP_ON, HEADER_PILL } from "./header-classes";

/** A chip's line icon, never an emoji (MESITA-2478): 1.75 stroke, 2.25 when
 *  on — BottomNav's pair. */
const CHIP_ICON = "h-4 w-4 shrink-0";

export function SearchHeader({
  locate,
  bar,
  chipsHidden = false,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the disc and the pill leave. */
  bar: ReactNode;
  /** While the bar is querying the chip row is not drawn (MESITA-2487);
   *  the results then hang just under the bar's row. */
  chipsHidden?: boolean;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const everyFamily = filters.familyKeys.length === 0;
  return (
    <div
      className="border-border bg-card relative z-30 shrink-0 border-b"
      data-search-header
      data-search-band
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        {locate}
        <div className="min-w-0 flex-1">{bar}</div>
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
      <div
        className={cn("relative", !chipsHidden && "border-border border-t")}
        data-search-chip-band
      >
        {chipsHidden ? null : (
          <nav
            aria-label="Families"
            className="scrollbar-hide flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2.5"
            data-search-chips
          >
            <button
              type="button"
              onClick={clearMapFamilies}
              aria-pressed={everyFamily}
              className={cn(CHIP, everyFamily ? CHIP_ON : CHIP_OFF)}
              data-search-chip-all
            >
              <FamilyIcon
                name="all"
                className={CHIP_ICON}
                strokeWidth={everyFamily ? 2.25 : 1.75}
              />
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
                  // Picking the lit family again goes back to All.
                  onClick={() => selectMapFamily(family.key)}
                  aria-pressed={on}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                >
                  <FamilyIcon
                    name={family.key}
                    className={CHIP_ICON}
                    strokeWidth={on ? 2.25 : 1.75}
                  />
                  <span>{family.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        {children ? (
          <div
            className={cn(
              "absolute inset-x-3 top-0 z-10 flex flex-col gap-2",
              chipsHidden && "pt-2",
            )}
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
