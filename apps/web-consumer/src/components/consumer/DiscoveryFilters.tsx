"use client";

import type { ReactNode } from "react";
import { Clock, MapPin, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  DISTANCE_STEPS_KM,
  hasDiscoveryPredicates,
  RANDOMNESS_LABELS,
  type CategoryOption,
  type WhereOption,
} from "@/lib/discovery-filters-engine";
import {
  patchDiscoveryFilters,
  resetDiscoveryFilters,
  toggleDiscoveryCategory,
  toggleDiscoveryFamily,
  useDiscoveryFilters,
} from "@/lib/use-discovery-filters";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) — FOUR
// MODULES, IN PATO'S ORDER (MESITA-660: "where / when / what / randomness.
// easy peasy. modular. in that order."):
//   Where      — 📍 Near me (no constraint) | super-zones (cities) | zones
//                (picking a city reveals its zones) + the Distance tolerance
//                sub-row in Near-me mode when geolocation is granted
//   When       — Now (neutral default) or a 0–23 hour: open at that hour,
//                place-local
//   What       — super-categories (six families) + concrete categories from
//                the catalog, multi; OR across the two tiers
//   Randomness — Ranked · Mild · Adventurous · Surprise (0–3). Shown on BOTH
//                surfaces: the store is shared, so it always drives the
//                Swipe deck's order, and it becomes XX's per-query input
//                when the Standard Engine wires.
// City/zone/category option lists derive from the catalog the host is
// actually showing — no pick can be a dead end. State lives in the ONE
// shared store (use-discovery-filters): both surfaces and both trigger dots
// read the same filters. Live-apply — every tap narrows immediately; the
// footer CTA is feedback (real count) + close, flipping to a reset action
// when the filters exclude everything.

export function DiscoveryFilters({
  onClose,
  whereOptions,
  categoryOptions,
  count,
  hasLocation,
}: {
  onClose: () => void;
  /** Cities + their zones present in the host's catalog, biggest first. */
  whereOptions: WhereOption[];
  /** Concrete categories present in the host's catalog, biggest first. */
  categoryOptions: CategoryOption[];
  /** How many places the current filters leave visible on the host. */
  count: number;
  /** Geolocation granted — enables the Here distance tolerance. */
  hasLocation: boolean;
}) {
  const filters = useDiscoveryFilters();
  // A narrowing predicate is set (randomness excluded — it never drops the
  // count). Splits the empty footer: predicates → reset escape; none → the
  // host is simply empty and Reset can't help (MESITA-670).
  const hasPredicates = hasDiscoveryPredicates(filters);

  const here = filters.city === null && filters.zone === null;
  const selectedZone = filters.zone;
  // The city whose zones row is expanded: an explicit city pick, or the
  // parent of the selected zone.
  const activeCity =
    filters.city ??
    (selectedZone !== null
      ? (whereOptions.find((o) => o.zones.includes(selectedZone))?.city ??
        null)
      : null);
  const activeCityZones =
    activeCity !== null
      ? (whereOptions.find((o) => o.city === activeCity)?.zones ?? [])
      : [];

  // Persisted picks can predate the current catalog (other surface, older
  // session). Surface them as extra active pills so a selection is never
  // invisible — tapping clears it back to Near me / all.
  const staleCity =
    filters.city !== null && !whereOptions.some((o) => o.city === filters.city)
      ? filters.city
      : null;
  const staleZone =
    selectedZone !== null &&
    !whereOptions.some((o) => o.zones.includes(selectedZone))
      ? selectedZone
      : null;
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
        <div className="flex flex-wrap gap-1.5">
          <Pill
            active={here}
            onClick={() => patchDiscoveryFilters({ city: null, zone: null })}
          >
            <MapPin className="h-3.5 w-3.5" /> Near me
          </Pill>
          {whereOptions.map((option) => (
            <Pill
              key={option.city}
              active={filters.city === option.city && filters.zone === null}
              onClick={() =>
                patchDiscoveryFilters({ city: option.city, zone: null })
              }
            >
              {option.city}
            </Pill>
          ))}
          {staleCity && (
            <Pill
              active
              onClick={() => patchDiscoveryFilters({ city: null, zone: null })}
            >
              {staleCity}
            </Pill>
          )}
          {staleZone && (
            <Pill
              active
              onClick={() => patchDiscoveryFilters({ city: null, zone: null })}
            >
              {staleZone}
            </Pill>
          )}
        </div>
        {activeCity !== null && activeCityZones.length > 0 && (
          <>
            <SectionLabel className="mt-3" sub>
              Zones in {activeCity}
            </SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {activeCityZones.map((zone) => (
                <Pill
                  key={zone}
                  active={filters.zone === zone}
                  onClick={() =>
                    filters.zone === zone
                      ? patchDiscoveryFilters({ city: activeCity, zone: null })
                      : patchDiscoveryFilters({ city: activeCity, zone })
                  }
                >
                  {zone}
                </Pill>
              ))}
            </div>
          </>
        )}
        {here && hasLocation && (
          <>
            <SectionLabel className="mt-3" sub>
              Distance
            </SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <Pill
                active={filters.maxKm === null}
                onClick={() => patchDiscoveryFilters({ maxKm: null })}
              >
                Any
              </Pill>
              {DISTANCE_STEPS_KM.map((km) => (
                <Pill
                  key={km}
                  active={filters.maxKm === km}
                  onClick={() => patchDiscoveryFilters({ maxKm: km })}
                >
                  {km} km
                </Pill>
              ))}
            </div>
          </>
        )}

        {/* ── Module 2 · When ──────────────────────────────────────── */}
        <SectionLabel className="mt-5">When</SectionLabel>
        <div className="flex items-center gap-3">
          <Pill
            active={filters.hour === null}
            onClick={() => patchDiscoveryFilters({ hour: null })}
          >
            <Clock className="h-3.5 w-3.5" /> Now
          </Pill>
          {filters.hour !== null && (
            <span className="font-display ml-auto text-base font-semibold tabular-nums">
              {formatHourLabel(filters.hour)}
            </span>
          )}
        </div>
        <HourRange
          value={filters.hour ?? new Date().getHours()}
          dimmed={filters.hour === null}
          onChange={(hour) => patchDiscoveryFilters({ hour })}
        />

        {/* ── Module 3 · What ──────────────────────────────────────── */}
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

        {/* ── Module 4 · Randomness ────────────────────────────────── */}
        <SectionLabel className="mt-5">Randomness</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {([0, 1, 2, 3] as const).map((level) => (
            <Pill
              key={level}
              active={filters.randomness === level}
              onClick={() => patchDiscoveryFilters({ randomness: level })}
            >
              {level === 0 && "🎯 "}
              {level === 3 && "🎲 "}
              {RANDOMNESS_LABELS[level]}
            </Pill>
          ))}
        </div>
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

/** "8:00 PM"-style label for a 0–23 hour. */
function formatHourLabel(hour: number): string {
  const clamped = Math.min(23, Math.max(0, Math.round(hour)));
  const suffix = clamped < 12 ? "AM" : "PM";
  const base = clamped % 12 === 0 ? 12 : clamped % 12;
  return `${base}:00 ${suffix}`;
}

function SectionLabel({
  children,
  className,
  sub = false,
}: {
  children: ReactNode;
  className?: string;
  /** Sub-row label inside a module (Distance, Zones in…, Categories). */
  sub?: boolean;
}) {
  return (
    <p
      className={cn(
        "mb-2 text-[11px] font-semibold tracking-wide",
        sub ? "text-muted-foreground/70" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected.
// min-h-11 keeps every filter control at the 44px touch floor.
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-sm"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Slim styled native range for the hour — brand fill up to the thumb.
// Dimmed while "Now" is active, but stays live: dragging it IS how the
// user leaves Now. Only rendered inside the sheet (client-only mount), so
// the new Date() resting position can't desync hydration.
function HourRange({
  value,
  dimmed,
  onChange,
}: {
  value: number;
  dimmed: boolean;
  onChange: (hour: number) => void;
}) {
  const pct = (value / 23) * 100;
  return (
    <input
      type="range"
      min={0}
      max={23}
      step={1}
      value={value}
      aria-label="Hour of day"
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full transition-opacity outline-none",
        "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
        dimmed && "opacity-50",
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
