"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  mapFiltersAreActive,
  MAP_STATUS_OPTIONS,
} from "@/lib/map-filters-engine";
import type { CategoryOption } from "@/lib/discovery-filters-engine";
import {
  resetMapFilters,
  toggleMapCategory,
  toggleMapFamily,
  toggleMapStatus,
  useMapFilters,
} from "@/lib/use-map-filters";
import {
  FilterModule,
  Pill,
  SectionLabel,
} from "@/components/consumer/discovery-filter-controls";

// Search-map Filters sheet. Status + Category only. Distance and time
// are not map knobs — the viewport already decides how far, and When
// belongs on Swipe.

export function SearchMapFilters({
  onClose,
  categoryOptions,
  count,
}: {
  onClose: () => void;
  categoryOptions: CategoryOption[];
  count: number | null;
}) {
  const filters = useMapFilters();
  const hasPredicates = mapFiltersAreActive(filters);
  const staleCategories = filters.categories.filter(
    (slug) => !categoryOptions.some((c) => c.slug === slug),
  );

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
          <FilterModule label="Status">
            <div className="flex flex-wrap gap-1.5">
              {MAP_STATUS_OPTIONS.map((option) => (
                <Pill
                  key={option.key}
                  active={filters.statuses.includes(option.key)}
                  onClick={() => toggleMapStatus(option.key)}
                >
                  {option.label}
                </Pill>
              ))}
            </div>
          </FilterModule>

          <FilterModule label="Category">
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
            {(categoryOptions.length > 1 || staleCategories.length > 0) && (
              <>
                <SectionLabel className="mt-3" sub>
                  Types
                </SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {categoryOptions.map((option) => (
                    <Pill
                      key={option.slug}
                      active={filters.categories.includes(option.slug)}
                      onClick={() => toggleMapCategory(option.slug)}
                    >
                      {option.label}
                    </Pill>
                  ))}
                  {staleCategories.map((slug) => (
                    <Pill
                      key={slug}
                      active
                      onClick={() => toggleMapCategory(slug)}
                    >
                      {slug}
                    </Pill>
                  ))}
                </div>
              </>
            )}
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
