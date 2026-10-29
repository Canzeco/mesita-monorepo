"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape). MESITA-2879 puts
// back the MESITA-2875 chip row and the three-control bar row ("Location |
// Searchbar | Ask AI / Families Carousel as in the past"):
//
//   (⌖) [ ⚲ Search places…   ] (✨ Ask AI)      three separate 48px controls
//   (≡) (▦ Top) (○ Coffee) …                    32px chips, floating
//
// THREE SEPARATE CONTROLS (Pato, MESITA-3009: "location at the left,
// searchbar, ask ai at the right, all separated"; MESITA-2999's one long
// bar held Ask AI and locate): the locate disc, the query bar, the white
// Ask AI pill with sparkles (→ Search › Chat; MESITA-3010). One token set for every control lives in header-classes.ts. NO ADD
// DISC (MESITA-2876's `+`), and no Add button since MESITA-2883: Add a
// place has its own sheet (MESITA-2902). Under the bar's row one chip row:
// THE FILTERS DISC AT THE FAR LEFT (Pato, MESITA-2882: "keep the Filters
// icon at the super left"), pinned outside the scroll: a white icon-only
// disc (MESITA-3006; MESITA-2999's worded chip "looks like [bad]"), then Top, then every
// family, each with its line icon (MESITA-2478: line icons, not emoji).
// Top, not All (Pato, MESITA-2882: "don't call it all, call it Top";
// MESITA-2879 had All, MESITA-2534 Top). THE DISC OPENS THE FILTERS SHEET
// (Pato, MESITA-2903: "when i click filters, open the modal to see select
// multiple families"; MESITA-2879 had deleted MESITA-2758's sheet and made
// the disc a clear): any number of families, applied at once. While any is
// picked the disc wears a small black bubble with the count (MESITA-3006;
// MESITA-2884's red disc is gone).
// NO NEARBY, NO POPULAR (MESITA-2499/2502): the map is the where, a chip
// is only the what. A chip picks its family ALONE; it is lit while its
// family is in the set (the sheet may hold several); Top is lit when none
// is; tapping the only lit family goes back to Top. Sent as the
// server-side `familyKeys`. The Minimum Popularity stays the operator's,
// Admin › Discovery › Area.
//
// NO BAND (Pato, MESITA-2996: "the searchbar must look more like the google
// one … it must have no background. and the categories must be floating
// too"; reverses MESITA-2413/2469's white band). The header is an overlay on
// the map's top edge: the rows are transparent and let taps through to the
// map, and each control is a white pill with a shadow (header-classes.ts).
// The chips are shorter than the bar (MESITA-2996; reverses MESITA-2445).
// `children` (the bar's results, the load error) COVER the chip row and run
// on over the map (MESITA-2417); while the bar queries the chip row is not
// drawn at all (MESITA-2487).

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { FamilyIcon } from "@/lib/family-icons";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { FamilyFilterSheet } from "./FamilyFilterSheet";
import { cn } from "@/lib/utils";
import {
  BAR,
  CHIP,
  CHIP_DISC,
  CHIP_OFF,
  CHIP_ON,
  HEADER_PILL,
} from "./header-classes";

/** A chip's line icon, never an emoji (MESITA-2478): 1.75 stroke, 2.25 when
 *  on — BottomNav's pair. */
const CHIP_ICON = "h-4 w-4 shrink-0";

/** The count bubble on the Filters disc's top-right corner while families
 *  are picked: ink, not red (Pato, MESITA-3006; MESITA-2884's red disc is
 *  gone), ringed in white so it reads off the disc. */
const DISC_BADGE =
  "bg-primary text-primary-foreground ring-card absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center type-meta rounded-full px-1 leading-none font-semibold ring-2";

export function SearchHeader({
  locate,
  bar,
  chipsHidden = false,
  children,
}: {
  /** The locate disc, left of the bar on row one. */
  locate: ReactNode;
  /** The query field; the bar takes what the two controls leave. */
  bar: ReactNode;
  /** While the bar is querying the chip row is not drawn (MESITA-2487);
   *  the results then hang just under the bar's row. */
  chipsHidden?: boolean;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const everyFamily = filters.familyKeys.length === 0;
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    // pointer-events-none on the overlay, back on for each control: the gaps
    // between the pills are the map's.
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
      data-search-header
    >
      {/* Row one, three separate controls (Pato, MESITA-3009: "location at
          the left, searchbar, ask ai at the right, all separated"). */}
      <div className="flex min-w-0 items-center gap-2 px-3 pt-3 [&>*]:pointer-events-auto">
        {locate}
        <div className={cn(BAR, "min-w-0 flex-1")}>{bar}</div>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          className={HEADER_PILL}
          data-search-ask-ai
        >
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>Ask AI</span>
        </Link>
      </div>
      <div className="relative" data-search-chip-band>
        {chipsHidden ? null : (
          // py-2 inside the scroller, not around it: its overflow would clip
          // the chips' shadows. That py-2 is the whole bar-to-chips gap: 8px,
          // the header's one gap, across and down (MESITA-3008).
          <div className="flex min-w-0 items-center gap-2 pl-3 [&>*]:pointer-events-auto">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={
                everyFamily
                  ? "Filters"
                  : `Filters (${filters.familyKeys.length} selected)`
              }
              aria-haspopup="dialog"
              data-active={everyFamily ? undefined : "true"}
              className={CHIP_DISC}
              data-search-filters
            >
              <SlidersHorizontal
                className="h-4 w-4 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
              {everyFamily ? null : (
                <span
                  aria-hidden
                  className={DISC_BADGE}
                  data-search-filters-badge
                >
                  {filters.familyKeys.length}
                </span>
              )}
            </button>
            <nav
              aria-label="Families"
              className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-2 pr-3"
              data-search-chips
            >
              <button
                type="button"
                onClick={clearMapFamilies}
                aria-pressed={everyFamily}
                className={cn(CHIP, everyFamily ? CHIP_ON : CHIP_OFF)}
                data-search-chip-top
              >
                <FamilyIcon
                  name="all"
                  className={CHIP_ICON}
                  strokeWidth={everyFamily ? 2.25 : 1.75}
                />
                <span>Top</span>
              </button>
              {FILTERABLE_PLACE_FAMILIES.map((family) => {
                const on = filters.familyKeys.includes(family.key);
                return (
                  <button
                    key={family.key}
                    type="button"
                    // Picking the lit family again goes back to Top.
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
          </div>
        )}
        {children ? (
          <div
            className={cn(
              "pointer-events-auto absolute inset-x-3 top-0 z-10 flex flex-col gap-2 pt-2",
            )}
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
      <FamilyFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
