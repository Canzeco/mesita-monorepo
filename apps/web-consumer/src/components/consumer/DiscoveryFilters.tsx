"use client";

import { LocateFixed } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { hasDiscoveryPredicates } from "@/lib/discovery-filters-engine";
import {
  resetDiscoveryFilters,
  setDiscoveryMinReviews,
  setDiscoveryPlacesScope,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import {
  FilterModule,
  FiltersSheetFooter,
  FiltersSheetHeader,
  Pill,
} from "./discovery-filter-controls";
import { SearchPlacesScope } from "./search/SearchPlacesScope";
import { SearchPopularity } from "./search/SearchPopularity";
import { cn } from "@/lib/utils";

// Feed + Scroll Filters. Same three guest params as the Search map
// (Family, Places scope, Google review floor), drawn by the same controls,
// plus one extra: connect current location. Dense on purpose — the sheet
// should not scroll.

export function DiscoveryFilters({
  onClose,
  count,
  hasLocation,
  locating = false,
  onLocate,
}: {
  onClose: () => void;
  count: number | null;
  hasLocation: boolean;
  locating?: boolean;
  onLocate?: () => void;
}) {
  const filters = useDiscoveryFilters();
  const hasPredicates = hasDiscoveryPredicates(filters);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FiltersSheetHeader onReset={resetDiscoveryFilters} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex flex-col gap-2">
          <FilterModule label="Family">
            <div className="flex flex-wrap gap-1">
              {FILTERABLE_PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  active={filters.familyKeys.includes(family.key)}
                  onClick={() => toggleDiscoveryFamily(family.key)}
                >
                  {family.label}
                </Pill>
              ))}
            </div>
          </FilterModule>

          <FilterModule label="Scope">
            <SearchPlacesScope
              label="Scope"
              scope={filters.placesScope}
              onScope={setDiscoveryPlacesScope}
            />
          </FilterModule>

          <FilterModule label="Minimum number of Google reviews">
            <SearchPopularity
              minReviews={filters.minReviews}
              onMinReviews={setDiscoveryMinReviews}
            />
          </FilterModule>

          <FilterModule label="Location">
            <button
              type="button"
              onClick={onLocate}
              disabled={hasLocation || !onLocate || locating}
              className={cn(
                "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                hasLocation
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border bg-muted/50 text-foreground hover:bg-muted",
              )}
            >
              <LocateFixed
                className={cn(
                  "h-4 w-4 shrink-0",
                  hasLocation ? "text-primary" : "text-muted-foreground",
                )}
              />
              {hasLocation
                ? "Using your location"
                : locating
                  ? "Locating…"
                  : "Use my location"}
            </button>
          </FilterModule>
        </div>
      </div>

      <FiltersSheetFooter
        count={count}
        hasPredicates={hasPredicates}
        onReset={resetDiscoveryFilters}
        onClose={onClose}
      />
    </div>
  );
}
