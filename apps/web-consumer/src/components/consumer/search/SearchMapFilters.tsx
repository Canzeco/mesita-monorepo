"use client";

import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { mapFiltersAreActive } from "@/lib/map-filters-engine";
import {
  clearMapFamilies,
  resetMapFilters,
  setMapMinReviews,
  toggleMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import {
  FilterModule,
  FiltersSheetFooter,
  FiltersSheetHeader,
  Pill,
} from "@/components/consumer/discovery-filter-controls";
import { SearchPopularity } from "./SearchPopularity";

// Search-map Filters sheet, DENSE, two modules IN THIS ORDER (Pato,
// 2026-10-17, MESITA-2298; the Places source switch left in MESITA-2384 —
// the guest never picks a source):
//
//   Families        All Families (the default: no family cut) or any set of
//                   the fifteen; the server turns the set into the union of
//                   their Google types.
//   Google Reviews  the review-count floor, 10+ / 100+ / 1,000+,
//                   default 100+; applied to Google hits after Google
//                   answers, never as a Nearby API param, never to a Mesita
//                   row.
//
// Location is not a module here: it is the disc at the left of the map's
// top row. How many is the operator's (`map.mesitaPlaces`, one Google call
// per load), the circle is operator `map.radiusKm`, and neither is a guest
// knob.

export function SearchMapFilters({
  onClose,
  count,
}: {
  onClose: () => void;
  count: number | null;
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
