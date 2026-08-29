"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLACE_FAMILIES } from "@/lib/place-families";
import { mapFiltersAreActive } from "@/lib/map-filters-engine";
import {
  resetMapFilters,
  setMapResultLimit,
  setMapSearchPower,
  toggleMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { FilterModule, Pill } from "@/components/consumer/discovery-filter-controls";
import { SearchPlacesScope } from "./SearchPlacesScope";
import { SearchResultLimit } from "./SearchResultLimit";

// Search-map Filters sheet. Super Category + Places Venn + How many.
// There is no Status chip row, Category, or Types axis. Places stays
// the nested Venn: Partners ⊂ Places ⊂ Google. Default is Places.
// How many is 20, 40, or 60 — closest N, nothing in between. Distance
// and time are not map knobs.

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
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
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

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
          <FilterModule label="Super Category">
            <div className="flex flex-wrap gap-1.5">
              {PLACE_FAMILIES.map((family) => (
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
              power={filters.searchPower}
              onPower={setMapSearchPower}
            />
          </FilterModule>

          <FilterModule label="How many">
            <SearchResultLimit
              limit={filters.resultLimit}
              onLimit={setMapResultLimit}
            />
          </FilterModule>
        </div>
      </div>

      <div className="border-border/60 shrink-0 border-t p-4">
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
