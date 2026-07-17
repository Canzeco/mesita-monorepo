"use client";

import { useState } from "react";
import {
  ChevronRight,
  Clock,
  Dices,
  Globe,
  LocateFixed,
  MapPin,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DISCOVERY_FILTER_TINTS,
  GradientRange,
  ModeCard,
  Pill,
  Section,
} from "./discovery-filters-ui";
import {
  ZONE_KIND_PLURAL_LABELS,
  ZONE_TREE,
  findZoneTrail,
  formatHourLabel,
  randomnessLabel,
  type ZoneNode,
} from "@/lib/mock/discovery-filters-mock";
import {
  PLACE_FAMILIES,
  placeFamilyByKey,
  type FamilyKey,
} from "@/lib/place-families";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) —
// un-parks the FiltersComingSoon panel from MESITA-249 with the real four
// filters: Where (hierarchical zones + near me), When (hour), What (the six
// place families — MESITA-635), Randomness (1–10). Visual language: one bordered
// card per filter with a differentiated tinted icon circle + live value
// pill; Near me / Anywhere are mode cards; zone and category chips are soft
// borderless pills that go brand-gradient when selected.
//
// FRONTEND-ONLY (MESITA-632): selections are local component state and are
// NOT applied to the deck / map yet — the recommender wiring lands with the
// filtering backend. Both host sheets mount this with keepMounted so
// selections survive a close. The one thing that DOES leave the sheet is
// `onActiveChange` (MESITA-633): fired on every change with whether any
// filter deviates from the defaults, so hosts can dot their trigger.

const DEFAULT_RANDOMNESS = 5;

type FiltersState = {
  /** Where — "near me" (default) or a zone-tree selection. */
  nearMe: boolean;
  /** Selected zone node id; null = anywhere. Only meaningful when !nearMe. */
  selectedZoneId: string | null;
  /** Drill path through the tree (breadcrumb) — browsing, not selection. */
  pathIds: string[];
  /** When — "now" (default) or the fixed `hour`. */
  whenNow: boolean;
  hour: number;
  /** What — multi-select place families; empty = every family. */
  familyKeys: FamilyKey[];
  /** Randomness — 1 plays it safe, 10 is full surprise. */
  randomness: number;
};

// Seeded client-side only (the sheet portals in after mount), so Date here
// can't desync hydration.
function defaultFiltersState(): FiltersState {
  return {
    nearMe: true,
    selectedZoneId: null,
    pathIds: [],
    whenNow: true,
    hour: new Date().getHours(),
    familyKeys: [],
    randomness: DEFAULT_RANDOMNESS,
  };
}

// "Any filter set?" — drives the trigger dot on both surfaces. The drill
// path and the parked hour don't count: browsing zones without picking one
// (or moving the slider and tapping Now again) leaves nothing applied.
function filtersAreActive(state: FiltersState): boolean {
  return (
    !state.nearMe ||
    !state.whenNow ||
    state.familyKeys.length > 0 ||
    state.randomness !== DEFAULT_RANDOMNESS
  );
}

/** Daypart glyph for the hour readout. */
function hourEmoji(hour: number): string {
  if (hour < 6) return "🌙";
  if (hour < 12) return "🌅";
  if (hour < 18) return "☀️";
  if (hour < 22) return "🌆";
  return "🌙";
}

export function DiscoveryFilters({
  onClose,
  onActiveChange,
}: {
  onClose: () => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<FiltersState>(defaultFiltersState);

  // Every mutation funnels through here so active-ness is reported in the
  // same event tick (no effects — react-hooks/set-state-in-effect).
  const patch = (partial: Partial<FiltersState>) => {
    const next = { ...state, ...partial };
    setState(next);
    onActiveChange?.(filtersAreActive(next));
  };

  const path = state.pathIds
    .map((id) => findZoneTrail(id)?.at(-1))
    .filter((n): n is ZoneNode => !!n);
  const level = path.at(-1);
  const options = level?.children ?? ZONE_TREE;
  const selectedTrail = state.selectedZoneId
    ? findZoneTrail(state.selectedZoneId)
    : null;
  const selectedZone = selectedTrail?.at(-1) ?? null;

  const pickZone = (node: ZoneNode) => {
    patch({
      nearMe: false,
      selectedZoneId: node.id,
      pathIds: node.children?.length
        ? [...state.pathIds, node.id]
        : state.pathIds,
    });
  };

  const jumpTo = (depth: number) =>
    patch({ pathIds: state.pathIds.slice(0, depth) });

  const toggleFamily = (key: FamilyKey) => {
    patch({
      familyKeys: state.familyKeys.includes(key)
        ? state.familyKeys.filter((k) => k !== key)
        : [...state.familyKeys, key],
    });
  };

  const reset = () => patch(defaultFiltersState());

  const anywhere = !state.nearMe && state.selectedZoneId === null;
  const whereSummary = state.nearMe
    ? "Near me"
    : (selectedZone?.name ?? "Anywhere");
  const whatSummary =
    state.familyKeys.length === 0
      ? "All"
      : state.familyKeys.length === 1
        ? (placeFamilyByKey(state.familyKeys[0])?.label ?? "1 selected")
        : `${state.familyKeys.length} selected`;
  const browseLabel = level
    ? `${ZONE_KIND_PLURAL_LABELS[options[0]?.kind ?? "zone"]} in ${level.name}`
    : "Browse by country";

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header — tinted icon circle + Reset ghost + close. */}
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
            onClick={reset}
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

      <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-1 pb-4">
        {/* ---- Where ------------------------------------------------- */}
        <Section
          icon={MapPin}
          label="Where"
          value={whereSummary}
          tint={DISCOVERY_FILTER_TINTS.where}
        >
          {/* Two mode cards: live location vs. the whole catalog. Picking
              a zone below deselects both. */}
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              icon={LocateFixed}
              title="Near me"
              sub="Current location"
              active={state.nearMe}
              onClick={() => patch({ nearMe: true })}
            />
            <ModeCard
              icon={Globe}
              title="Anywhere"
              sub="No zone limit"
              active={anywhere}
              onClick={() => patch({ nearMe: false, selectedZoneId: null })}
            />
          </div>

          {/* Zone browser — segmented breadcrumb bar + drillable pills. */}
          <p className="text-muted-foreground mt-3 mb-1.5 text-[11px] font-semibold">
            {browseLabel}
          </p>
          <div className="bg-muted/60 scrollbar-hide -mx-0.5 flex items-center gap-0.5 overflow-x-auto rounded-xl p-1 whitespace-nowrap">
            <button
              type="button"
              onClick={() => jumpTo(0)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                path.length === 0
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🌎 World
            </button>
            {path.map((node, i) => (
              <span key={node.id} className="flex shrink-0 items-center">
                <ChevronRight className="text-muted-foreground/40 h-3 w-3 shrink-0" />
                <button
                  type="button"
                  onClick={() => jumpTo(i + 1)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                    i === path.length - 1
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {node.name}
                </button>
              </span>
            ))}
          </div>

          {/* Current level — "All <level>" first once drilled, then the
              children; pills with children drill deeper on tap. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {level && (
              <Pill
                active={!state.nearMe && state.selectedZoneId === level.id}
                onClick={() =>
                  patch({ nearMe: false, selectedZoneId: level.id })
                }
              >
                All {level.name}
              </Pill>
            )}
            {options.map((node) => (
              <Pill
                key={node.id}
                active={!state.nearMe && state.selectedZoneId === node.id}
                onClick={() => pickZone(node)}
                trailing={
                  node.children?.length ? (
                    <ChevronRight className="-mr-1 h-3.5 w-3.5 opacity-50" />
                  ) : null
                }
              >
                {node.name}
              </Pill>
            ))}
          </div>
        </Section>

        {/* ---- When -------------------------------------------------- */}
        <Section
          icon={Clock}
          label="When"
          value={state.whenNow ? "Now" : formatHourLabel(state.hour)}
          tint={DISCOVERY_FILTER_TINTS.when}
        >
          <div className="flex items-center gap-3">
            <Pill
              active={state.whenNow}
              onClick={() =>
                patch({ whenNow: true, hour: new Date().getHours() })
              }
            >
              Now
            </Pill>
            <span
              className={cn(
                "font-display ml-auto flex items-center gap-1.5 text-lg font-semibold tabular-nums transition",
                state.whenNow && "text-muted-foreground/60",
              )}
            >
              <span className="text-base" aria-hidden="true">
                {hourEmoji(state.hour)}
              </span>
              {formatHourLabel(state.hour)}
            </span>
          </div>
          <GradientRange
            min={0}
            max={23}
            value={state.hour}
            ariaLabel="Hour of day"
            dimmed={state.whenNow}
            onChange={(next) => patch({ whenNow: false, hour: next })}
            className="mt-3"
          />
          <div className="text-muted-foreground/70 mt-1.5 flex justify-between text-[10px] font-medium">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </Section>

        {/* ---- What -------------------------------------------------- */}
        <Section
          icon={Tag}
          label="What"
          value={whatSummary}
          tint={DISCOVERY_FILTER_TINTS.what}
        >
          {/* The six place families — every Mesita place rolls up to exactly
              one, so the whole set wraps into view with no scrolling.
              Multi-select; empty selection = All. */}
          <div className="flex flex-wrap gap-1.5">
            <Pill
              active={state.familyKeys.length === 0}
              onClick={() => patch({ familyKeys: [] })}
            >
              ✨ All
            </Pill>
            {PLACE_FAMILIES.map((family) => (
              <Pill
                key={family.key}
                active={state.familyKeys.includes(family.key)}
                onClick={() => toggleFamily(family.key)}
              >
                {family.emoji} {family.label}
              </Pill>
            ))}
          </div>
        </Section>

        {/* ---- Randomness -------------------------------------------- */}
        <Section
          icon={Dices}
          label="Randomness"
          value={`${state.randomness} · ${randomnessLabel(state.randomness)}`}
          tint={DISCOVERY_FILTER_TINTS.random}
        >
          <GradientRange
            min={1}
            max={10}
            value={state.randomness}
            ariaLabel="Randomness level"
            onChange={(next) => patch({ randomness: next })}
          />
          <div className="text-muted-foreground mt-2 flex items-baseline justify-between text-[11px] font-medium">
            <span>🎯 Play it safe</span>
            <span className="text-foreground font-semibold">
              {randomnessLabel(state.randomness)}
            </span>
            <span>🎲 Surprise me</span>
          </div>
        </Section>
      </div>

      {/* Footer CTA — presentational for now: applying just closes the
          sheet (selections persist via keepMounted). */}
      <div className="border-border/60 shrink-0 border-t p-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Show places
        </button>
      </div>
    </div>
  );
}
