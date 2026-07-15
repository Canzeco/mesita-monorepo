"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Dices,
  Globe,
  LocateFixed,
  MapPin,
  SlidersHorizontal,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FILTER_CATEGORIES,
  ZONE_KIND_PLURAL_LABELS,
  ZONE_TREE,
  findZoneTrail,
  formatHourLabel,
  randomnessLabel,
  type ZoneNode,
} from "@/lib/mock/discovery-filters-mock";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) —
// un-parks the FiltersComingSoon panel from MESITA-249 with the real four
// filters: Where (hierarchical zones + near me), When (hour), What (place
// category), Randomness (1–10). Visual language (MESITA-634): one bordered
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
  /** What — multi-select category slugs; empty = all categories. */
  categorySlugs: string[];
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
    categorySlugs: [],
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
    state.categorySlugs.length > 0 ||
    state.randomness !== DEFAULT_RANDOMNESS
  );
}

// Per-section accent — tinted icon circle + value pill (premium bar:
// differentiated colors, never four identical gray rows).
const TINTS = {
  where: { circle: "bg-primary/10 text-primary", pill: "bg-primary/10 text-primary" },
  when: { circle: "bg-amber-500/15 text-amber-600", pill: "bg-amber-500/15 text-amber-700" },
  what: { circle: "bg-violet-500/15 text-violet-600", pill: "bg-violet-500/15 text-violet-700" },
  random: { circle: "bg-emerald-500/15 text-emerald-600", pill: "bg-emerald-500/15 text-emerald-700" },
} as const;

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

  const toggleCategory = (slug: string) => {
    patch({
      categorySlugs: state.categorySlugs.includes(slug)
        ? state.categorySlugs.filter((s) => s !== slug)
        : [...state.categorySlugs, slug],
    });
  };

  const reset = () => patch(defaultFiltersState());

  const anywhere = !state.nearMe && state.selectedZoneId === null;
  const whereSummary = state.nearMe
    ? "Near me"
    : (selectedZone?.name ?? "Anywhere");
  const whatSummary =
    state.categorySlugs.length === 0
      ? "All"
      : state.categorySlugs.length === 1
        ? (FILTER_CATEGORIES.find((c) => c.slug === state.categorySlugs[0])
            ?.label ?? "1 selected")
        : `${state.categorySlugs.length} selected`;
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
          tint={TINTS.where}
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
          tint={TINTS.when}
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
          tint={TINTS.what}
        >
          {/* Two-row horizontal pill grid keeps 20+ categories browsable
              without turning the sheet into a wall. Multi-select; empty
              selection = All. -mx-4 bleeds the scroll to the card edge. */}
          <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
            <div className="grid w-max grid-flow-col grid-rows-2 gap-1.5">
              <Pill
                active={state.categorySlugs.length === 0}
                onClick={() => patch({ categorySlugs: [] })}
              >
                ✨ All
              </Pill>
              {FILTER_CATEGORIES.map((category) => (
                <Pill
                  key={category.slug}
                  active={state.categorySlugs.includes(category.slug)}
                  onClick={() => toggleCategory(category.slug)}
                >
                  {category.label}
                </Pill>
              ))}
            </div>
          </div>
        </Section>

        {/* ---- Randomness -------------------------------------------- */}
        <Section
          icon={Dices}
          label="Randomness"
          value={`${state.randomness} · ${randomnessLabel(state.randomness)}`}
          tint={TINTS.random}
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

// One filter = one card: tinted icon circle + title + live value pill.
function Section({
  icon: Icon,
  label,
  value,
  tint,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  tint: { circle: string; pill: string };
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            tint.circle,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold">{label}</span>
        {value && (
          <span
            className={cn(
              "ml-auto max-w-[55%] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold",
              tint.pill,
            )}
          >
            {value}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// Where mode card (Near me / Anywhere) — icon circle, label, check badge.
function ModeCard({
  icon: Icon,
  title,
  sub,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition active:scale-[0.98]",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          active
            ? "bg-pink-gradient text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-tight font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground block truncate text-[10px] leading-tight">
          {sub}
        </span>
      </span>
      {active && (
        <span
          className="bg-primary absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full text-white shadow-sm"
          aria-hidden="true"
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}
    </button>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected.
function Pill({
  active,
  onClick,
  trailing,
  children,
}: {
  active: boolean;
  onClick: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient text-white shadow-sm"
          : "bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      {trailing}
    </button>
  );
}

// Styled native range input: brand-gradient fill up to the thumb, muted
// track after it, white-ringed thumb. Inline background because the fill
// percentage is dynamic.
function GradientRange({
  min,
  max,
  value,
  onChange,
  ariaLabel,
  dimmed = false,
  className,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  dimmed?: boolean;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full transition-opacity outline-none",
        "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
        dimmed && "opacity-50",
        className,
      )}
      style={{
        background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)`,
      }}
    />
  );
}
