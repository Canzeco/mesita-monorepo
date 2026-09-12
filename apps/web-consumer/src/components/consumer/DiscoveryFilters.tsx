"use client";

import { LocateFixed, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  DISCOVERY_REVIEW_STOPS,
  formatReviewFloor,
  hasDiscoveryPredicates,
} from "@/lib/discovery-filters-engine";
import {
  resetDiscoveryFilters,
  setDiscoveryMinReviews,
  setDiscoveryPlacesScope,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import { FilterModule, Pill } from "./discovery-filter-controls";
import { DiscoveryPlacesScope } from "./DiscoveryPlacesScope";
import { cn } from "@/lib/utils";

// Feed + Scroll Filters. Same three guest params as the Search map
// (Super Category, Places scope, Google review floor) plus one extra:
// connect current location. Dense on purpose — the sheet should not scroll.

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
            onClick={resetDiscoveryFilters}
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
                  onClick={() => toggleDiscoveryFamily(family.key)}
                >
                  {family.label}
                </Pill>
              ))}
            </div>
          </FilterModule>

          <FilterModule label="Scope" dense>
            <DiscoveryPlacesScope
              scope={filters.placesScope}
              onScope={setDiscoveryPlacesScope}
            />
          </FilterModule>

          <FilterModule label="Google reviews" dense>
            <p className="text-muted-foreground mb-1.5 type-meta">
              Review count, not stars.
            </p>
            <div
              role="radiogroup"
              aria-label="Google reviews"
              aria-orientation="horizontal"
              className="border-border flex overflow-hidden rounded-xl border"
            >
              {DISCOVERY_REVIEW_STOPS.map((stop, index) => {
                const active = filters.minReviews === stop;
                return (
                  <button
                    key={stop}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={
                      stop === 0
                        ? "Any number of Google reviews"
                        : `At least ${formatReviewFloor(stop)} Google reviews`
                    }
                    onClick={() => setDiscoveryMinReviews(stop)}
                    className={cn(
                      "inline-flex min-h-9 flex-1 items-center justify-center px-1 text-center type-meta whitespace-nowrap tabular-nums transition",
                      index > 0 && "border-border border-l",
                      active
                        ? "bg-foreground text-background font-bold"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
                    )}
                  >
                    {formatReviewFloor(stop)}
                  </button>
                );
              })}
            </div>
          </FilterModule>

          <FilterModule label="Location" dense>
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
            onClick={resetDiscoveryFilters}
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
