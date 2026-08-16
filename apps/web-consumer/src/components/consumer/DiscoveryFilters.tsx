"use client";

import { Clock, SlidersHorizontal, X } from "lucide-react";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  RANDOMNESS_LABELS,
  RANDOMNESS_MAX,
  RANDOMNESS_MIN,
  WEEKDAY_LABELS,
  formatHourLabel,
  hasDiscoveryPredicates,
  type CategoryOption,
  type RandomnessLevel,
} from "@/lib/discovery-filters-engine";
import {
  resetDiscoveryFilters,
  setDiscoveryMaxKm,
  setDiscoveryRandomness,
  setDiscoveryWhen,
  toggleDiscoveryCategory,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";
import { DiscoveryZoneField } from "./discovery-zone-field";
import {
  FilterGroupLabel,
  FilterModule,
  Pill,
  RangeSlider,
  SectionLabel,
} from "./discovery-filter-controls";

// Shared body of the discovery Filters route modal (Home Swipe + Search) —
// MESITA-905 simplify + routed /filters. INTENT (Where · When · What) +
// Random (word levels low→max), each in a modular box. That — the ask — is
// Memo's, not a filter: it rides Memo's own recall call. State in
// use-discovery-filters; dismiss via onClose → router.back().

export function DiscoveryFilters({
  onClose,
  categoryOptions,
  count,
  hasLocation,
}: {
  onClose: () => void;
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible; null = unknown host. */
  count: number | null;
  /** Geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  const filters = useDiscoveryFilters();
  const hasPredicates = hasDiscoveryPredicates(filters);
  const hasCenter = filters.zone !== null || hasLocation;
  const when = filters.when;

  const startAt = () => {
    const now = new Date();
    setDiscoveryWhen({ mode: "at", day: now.getDay(), hour: now.getHours() });
  };

  const staleCategories = filters.categories.filter(
    (slug) => !categoryOptions.some((c) => c.slug === slug),
  );

  const distanceKm = filters.maxKm ?? DISTANCE_MAX_KM;

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
            onClick={resetDiscoveryFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-3 py-1.5 text-xs font-medium transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex h-8 w-8 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <FilterGroupLabel>Intent · where when what</FilterGroupLabel>

        <div className="flex flex-col gap-3">
          <FilterModule label="Where">
            <DiscoveryZoneField zone={filters.zone} hasLocation={hasLocation} />

            <SectionLabel className="mt-3" sub>
              Distance tolerance
            </SectionLabel>
            {hasCenter ? (
              <>
                <div className="mb-1 flex justify-end">
                  <span className="text-foreground text-sm font-semibold tabular-nums">
                    {filters.maxKm === null
                      ? "Any"
                      : `within ${filters.maxKm} km`}
                  </span>
                </div>
                <RangeSlider
                  className="mt-2"
                  min={DISTANCE_MIN_KM}
                  max={DISTANCE_MAX_KM}
                  value={distanceKm}
                  ariaLabel="Distance tolerance in kilometres"
                  onChange={(km) =>
                    setDiscoveryMaxKm(km >= DISTANCE_MAX_KM ? null : km)
                  }
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                  <span>{DISTANCE_MIN_KM} km</span>
                  <span>Any</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground/70 text-[11px]">
                Pick a location above or turn on device location to filter by
                distance.
              </p>
            )}
          </FilterModule>

          <FilterModule label="When">
            <div className="flex flex-wrap gap-1.5">
              <Pill
                active={when.mode === "now"}
                onClick={() => setDiscoveryWhen({ mode: "now" })}
              >
                <Clock className="h-3.5 w-3.5" /> Now
              </Pill>
              <Pill
                active={when.mode === "anytime"}
                onClick={() => setDiscoveryWhen({ mode: "anytime" })}
              >
                Anytime
              </Pill>
              <Pill active={when.mode === "at"} onClick={startAt}>
                Pick a time
              </Pill>
            </div>
            {when.mode === "at" && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <Pill
                      key={label}
                      active={when.day === day}
                      onClick={() =>
                        setDiscoveryWhen({ mode: "at", day, hour: when.hour })
                      }
                    >
                      {label}
                    </Pill>
                  ))}
                </div>
                <div className="mt-3 flex items-center">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wide">
                    Open at
                  </span>
                  <span className="font-display ml-auto text-base font-semibold tabular-nums">
                    {formatHourLabel(when.hour)}
                  </span>
                </div>
                <RangeSlider
                  className="mt-3"
                  min={0}
                  max={23}
                  value={when.hour}
                  ariaLabel="Hour of day"
                  onChange={(hour) =>
                    setDiscoveryWhen({ mode: "at", day: when.day, hour })
                  }
                />
              </div>
            )}
          </FilterModule>

          <FilterModule label="What">
            <div className="flex flex-wrap gap-1.5">
              {PLACE_FAMILIES.map((family) => (
                <Pill
                  key={family.key}
                  active={filters.familyKeys.includes(family.key)}
                  onClick={() => toggleDiscoveryFamily(family.key)}
                >
                  {family.emoji} {family.label}
                </Pill>
              ))}
            </div>
            {(categoryOptions.length > 1 || staleCategories.length > 0) && (
              <>
                <SectionLabel className="mt-3" sub>
                  Categories
                </SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {categoryOptions.map((option) => (
                    <Pill
                      key={option.slug}
                      active={filters.categories.includes(option.slug)}
                      onClick={() => toggleDiscoveryCategory(option.slug)}
                    >
                      {option.label}
                    </Pill>
                  ))}
                  {staleCategories.map((slug) => (
                    <Pill
                      key={slug}
                      active
                      onClick={() => toggleDiscoveryCategory(slug)}
                    >
                      {slug}
                    </Pill>
                  ))}
                </div>
              </>
            )}
          </FilterModule>

          <FilterModule label="Random">
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px] font-medium">
              {RANDOMNESS_LABELS.map((label, i) => (
                <span
                  key={label}
                  className={
                    filters.randomness === i
                      ? "text-foreground font-semibold"
                      : undefined
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <RangeSlider
              min={RANDOMNESS_MIN}
              max={RANDOMNESS_MAX}
              value={filters.randomness}
              ariaLabel="Random level"
              onChange={(n) => setDiscoveryRandomness(n as RandomnessLevel)}
            />
          </FilterModule>
        </div>
      </div>

      <div className="border-border/60 shrink-0 border-t p-4">
        {count != null && count > 0 ? (
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            Show {count} {count === 1 ? "place" : "places"}
          </button>
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
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
