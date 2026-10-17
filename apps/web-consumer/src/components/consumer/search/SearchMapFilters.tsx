"use client";

import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  mapFiltersAreActive,
  type MapPlacesScope,
} from "@/lib/map-filters-engine";
import {
  clearMapFamilies,
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
// Families is All Families (the default: no family cut) or any set of the
// fifteen; the server turns the set into the union of their Google types
// (MESITA-2298). Google Reviews is the review-count floor, 0+ / 10+ / 100+ /
// 1,000+, default 100+; applied after Google answers, never as a Nearby API
// param, and never to Mesita Selected.

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
          <FilterModule label="Families">
            <div className="flex flex-wrap gap-1">
              <Pill
                active={filters.familyKeys.length === 0}
                onClick={clearMapFamilies}
              >
                All Families
              </Pill>
              {FILTERABLE_PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  active={filters.familyKeys.includes(family.key)}
                  onClick={() => toggleMapFamily(family.key)}
                >
                  <span aria-hidden>{family.emoji}</span> {family.label}
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
