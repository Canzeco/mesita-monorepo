"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { FilterModule, Pill } from "@/components/consumer/discovery-filter-controls";
import { SearchPlacesScope } from "./SearchPlacesScope";
import { SearchPopularity } from "./SearchPopularity";

// Search-map Filters sheet. Super Category + Places + Popularity, DENSE.
// How many (closest N) is operator `map.pinCount`, not a guest knob.
//
// Places is THREE NESTED SETS (Pato, 2026-09-05):
//   Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner Places
// Default is the middle ring — a discovery surface never opens on "only
// the places that pay us".
//
// Popularity is the Google review-count floor (0 / 10 / 100 / 1k / 10k).
// Discovery-mode, not a Nearby API param.

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
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <p className="font-display text-lg leading-tight font-semibold tracking-tight">
            Filters
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetMapFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex min-h-11 items-center rounded-full px-3 text-xs font-medium transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-11 w-11 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex flex-col gap-2">
          <FilterModule label="Super Category" dense>
            <div className="flex flex-wrap gap-1">
              {FILTERABLE_PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  size="sm"
                  active={filters.familyKeys.includes(family.key)}
                  onClick={() => toggleMapFamily(family.key)}
                >
                  {family.label}
                </Pill>
              ))}
            </div>
          </FilterModule>

          <FilterModule label="Places" dense>
            <SearchPlacesScope
              scope={filters.placesScope}
              onScope={setMapPlacesScope}
              counts={scopeCounts}
            />
          </FilterModule>

          <FilterModule label="Popularity" dense>
            <SearchPopularity
              minReviews={filters.minReviews}
              onMinReviews={setMapMinReviews}
            />
          </FilterModule>
        </div>
      </div>

      <div className="border-border/60 shrink-0 border-t px-4 py-3">
        {count != null && count > 0 ? (
          <Button
            type="button"
            size="lg"
            onClick={onClose}
            className="shadow-glow w-full text-sm font-semibold"
          >
            Show {count} {count === 1 ? "place" : "places"}
          </Button>
        ) : count === 0 && hasPredicates ? (
          <button
            type="button"
            onClick={resetMapFilters}
            className="bg-foreground text-background flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.99]"
          >
            No matches — reset filters
          </button>
        ) : count === 0 ? (
          <div className="bg-muted/60 text-muted-foreground flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium">
            No places to show
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onClose}
            className="shadow-glow w-full text-sm font-semibold"
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
