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

// Search-map Filters sheet, DENSE, three modules IN THIS ORDER (Pato,
// 2026-10-17, MESITA-2298):
//
//   Places          Google Places · Mesita Selected — the guest picks one.
//   Families        All Families (the default: no family cut) or any set of
//                   the fifteen; the server turns the set into the union of
//                   their Google types.
//   Google Reviews  the review-count floor, 0+ / 10+ / 100+ / 1,000+,
//                   default 100+; applied after Google answers, never as a
//                   Nearby API param, and never to Mesita Selected.
//
// Location is not a module here: it is the disc at the left of the map's
// top row. How many (closest N) is operator `map.pinCount`, the circle is
// operator `map.radiusKm`, and neither is a guest knob.

export function SearchMapFilters({
  onClose,
  count,
  scopeCounts,
}: {
  onClose: () => void;
  count: number | null;
  /** Places each scope would show, from the catalog already in hand. */
  scopeCounts?: Partial<Record<MapPlacesScope, number>>;
}) {
  const filters = useMapFilters();
  const hasPredicates = mapFiltersAreActive(filters);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FiltersSheetHeader onReset={resetMapFilters} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex flex-col gap-2">
          <FilterModule label="Places">
            <SearchPlacesScope
              scope={filters.placesScope}
              onScope={setMapPlacesScope}
              counts={scopeCounts}
            />
          </FilterModule>

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

          <FilterModule label="Google Reviews">
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
