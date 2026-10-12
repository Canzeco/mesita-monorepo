"use client";

import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  mapFiltersAreActive,
  type MapPlacesScope,
} from "@/lib/map-filters-engine";
import {
  resetMapFilters,
  setMapMinReviews,
  setMapPlacesScope,
  toggleMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import {
  FilterModule,
  FiltersSheetFooter,
  FiltersSheetHeader,
  Pill,
} from "@/components/consumer/discovery-filter-controls";
import { SearchPlacesScope } from "./SearchPlacesScope";
import { SearchPopularity } from "./SearchPopularity";

// Search-map Filters sheet. Family + Places + Popularity, DENSE.
// How many (closest N) is operator `map.pinCount`, not a guest knob.
//
// Places is THREE NESTED SETS (Pato, 2026-10-12, MESITA-2158):
//   Google Places ⊃ Mesita Places ⊃ Mesita Enriched Places
// Default is the inner ring — the places Mesita has actually written up.
//
// Popularity is the Google review-count floor (0 / 10 / 100 / 1k / 10k).
// Guest copy is "Minimum number of Google reviews" with 0 / 10+ / 100+ /
// 1K+ / 10K+. Discovery-mode, not a Nearby API param.

export function SearchMapFilters({
  onClose,
  count,
  scopeCounts,
}: {
  onClose: () => void;
  count: number | null;
  /** Places each Places ring would show, from the catalog already in hand. */
  scopeCounts?: Partial<Record<MapPlacesScope, number>>;
}) {
  const filters = useMapFilters();
  const hasPredicates = mapFiltersAreActive(filters);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FiltersSheetHeader onReset={resetMapFilters} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex flex-col gap-2">
          <FilterModule label="Family">
            <div className="flex flex-wrap gap-1">
              {FILTERABLE_PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  active={filters.familyKeys.includes(family.key)}
                  onClick={() => toggleMapFamily(family.key)}
                >
                  {family.label}
                </Pill>
              ))}
            </div>
          </FilterModule>

          <FilterModule label="Places">
            <SearchPlacesScope
              scope={filters.placesScope}
              onScope={setMapPlacesScope}
              counts={scopeCounts}
            />
          </FilterModule>

          <FilterModule label="Minimum number of Google reviews">
            <SearchPopularity
              minReviews={filters.minReviews}
              onMinReviews={setMapMinReviews}
            />
          </FilterModule>
        </div>
      </div>

      <FiltersSheetFooter
        count={count}
        hasPredicates={hasPredicates}
        onReset={resetMapFilters}
        onClose={onClose}
      />
    </div>
  );
}
