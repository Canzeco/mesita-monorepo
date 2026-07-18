"use client";

import { Clock, SlidersHorizontal, X } from "lucide-react";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  RANDOMNESS_ENDPOINTS,
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
import { Pill, RangeSlider, SectionLabel } from "./discovery-filter-controls";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) — FIVE
// PARAMETERS, IN PATO'S ORDER (MESITA-672):
//   Where      — 📍 search any location (address → neighbourhood → city →
//                state → country) OR current location → a CENTER
//   Distance   — a km radius around that center (the distance tolerance)
//   When       — Now (open right now) · Anytime · a specific weekday + hour
//   What       — six families + concrete categories from the catalog, multi;
//                OR across the two tiers
//   Randomness — a 0–5 level (Ranked → Surprise). Drives the Swipe deck order
//                (and becomes XX's per-query input once the Standard Engine
//                wires); the map's pin set is unaffected client-side.
// State lives in the ONE shared store (use-discovery-filters): both surfaces
// and both trigger dots read the same filters. Live-apply — every change
// narrows immediately; the footer CTA is feedback (real count) + close, and
// splits the zero state honestly (MESITA-670): a narrowing predicate → the
// reset escape; nothing filtered → a neutral note (the host is just empty).

export function DiscoveryFilters({
  onClose,
  categoryOptions,
  count,
  hasLocation,
}: {
  onClose: () => void;
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  const filters = useDiscoveryFilters();
  const hasPredicates = hasDiscoveryPredicates(filters);
  // A center to measure distance from — a searched zone or the device fix.
  const hasCenter = filters.zone !== null || hasLocation;
  const when = filters.when;

  const startAt = () => {
    const now = new Date();
    setDiscoveryWhen({ mode: "at", day: now.getDay(), hour: now.getHours() });
  };

  const staleCategories = filters.categories.filter(
    (slug) => !categoryOptions.some((c) => c.slug === slug),
  );

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header — the sheet's ONE tinted icon circle + Reset ghost + close. */}
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
        {/* ── Module 1 · Where ─────────────────────────────────────── */}
        <SectionLabel>Where</SectionLabel>
        <DiscoveryZoneField zone={filters.zone} hasLocation={hasLocation} />

        {/* ── Module 2 · Distance ──────────────────────────────────── */}
        <SectionLabel className="mt-5">Distance</SectionLabel>
        {hasCenter ? (
          <>
            <div className="mb-1 flex items-center gap-3">
              <Pill
                active={filters.maxKm === null}
                onClick={() => setDiscoveryMaxKm(null)}
              >
                Any
              </Pill>
              <span className="font-display ml-auto text-base font-semibold tabular-nums">
                {filters.maxKm === null
                  ? "Any distance"
                  : `within ${filters.maxKm} km`}
              </span>
            </div>
            <RangeSlider
              className="mt-3"
              min={DISTANCE_MIN_KM}
              max={DISTANCE_MAX_KM}
              value={filters.maxKm ?? 10}
              dimmed={filters.maxKm === null}
              ariaLabel="Distance tolerance in kilometres"
              onChange={(km) => setDiscoveryMaxKm(km)}
            />
          </>
        ) : (
          <p className="text-muted-foreground/70 text-[11px]">
            Pick a location above or turn on device location to filter by
            distance.
          </p>
        )}

        {/* ── Module 3 · When ──────────────────────────────────────── */}
        <SectionLabel className="mt-5">When</SectionLabel>
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

        {/* ── Module 4 · What ──────────────────────────────────────── */}
        <SectionLabel className="mt-5">What</SectionLabel>
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

        {/* ── Module 5 · Randomness ────────────────────────────────── */}
        <SectionLabel className="mt-5">Randomness</SectionLabel>
        <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px] font-medium">
          <span>{RANDOMNESS_ENDPOINTS.min}</span>
          <span className="text-foreground font-display text-base font-semibold tabular-nums">
            {filters.randomness}
          </span>
          <span>{RANDOMNESS_ENDPOINTS.max}</span>
        </div>
        <RangeSlider
          min={RANDOMNESS_MIN}
          max={RANDOMNESS_MAX}
          value={filters.randomness}
          ariaLabel="Randomness level, 0 to 5"
          onChange={(n) => setDiscoveryRandomness(n as RandomnessLevel)}
        />
      </div>

      {/* Footer CTA — live count feedback + close. Zero splits two ways: a
          narrowing predicate set flips it into the reset escape (dead end, one
          tap out); nothing filtered means the host is simply empty, so Reset
          can't help — a neutral, non-actionable note stands in (MESITA-670). */}
      <div className="border-border/60 shrink-0 border-t p-4">
        {count > 0 ? (
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            Show {count} {count === 1 ? "place" : "places"}
          </button>
        ) : hasPredicates ? (
          <button
            type="button"
            onClick={resetDiscoveryFilters}
            className="bg-foreground text-background flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-[0.99]"
          >
            No matches — reset filters
          </button>
        ) : (
          <div className="bg-muted/60 text-muted-foreground flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium">
            No places to show
          </div>
        )}
      </div>
    </div>
  );
}
