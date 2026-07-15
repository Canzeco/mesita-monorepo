"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  Clock,
  Dices,
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
  ZONE_KIND_LABELS,
  ZONE_TREE,
  findZoneTrail,
  formatHourLabel,
  randomnessLabel,
  type ZoneNode,
} from "@/lib/mock/discovery-filters-mock";

// Shared body of the discovery FilterSheet (Home Swipe + Search map) —
// un-parks the FiltersComingSoon panel from MESITA-249 with the real four
// filters: Where (hierarchical zones + near me), When (hour), What (place
// category), Randomness (1–10).
//
// FRONTEND-ONLY (MESITA-632): selections are local component state and are
// NOT applied to the deck / map yet — the recommender wiring lands with the
// filtering backend. Both host sheets mount this with keepMounted so
// selections survive a close.

const DEFAULT_RANDOMNESS = 5;

export function DiscoveryFilters({ onClose }: { onClose: () => void }) {
  // Where — "near me" or a node of the zone tree; null zone = anywhere.
  const [nearMe, setNearMe] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  // Drill path through the tree (breadcrumb). Kept separate from the
  // selection so browsing deeper never loses what's picked.
  const [pathIds, setPathIds] = useState<string[]>([]);
  // When — "now" or a fixed 0–23 hour. Seeded client-side only (the sheet
  // portals in after mount), so Date here can't desync hydration.
  const [whenNow, setWhenNow] = useState(true);
  const [hour, setHour] = useState(() => new Date().getHours());
  // What — multi-select category slugs; empty = all categories.
  const [categorySlugs, setCategorySlugs] = useState<string[]>([]);
  // Randomness — 1 plays it safe, 10 is full surprise.
  const [randomness, setRandomness] = useState(DEFAULT_RANDOMNESS);

  const path = pathIds
    .map((id) => findZoneTrail(id)?.at(-1))
    .filter((n): n is ZoneNode => !!n);
  const level = path.at(-1);
  const options = level?.children ?? ZONE_TREE;
  const selectedTrail = selectedZoneId ? findZoneTrail(selectedZoneId) : null;
  const selectedZone = selectedTrail?.at(-1) ?? null;

  const pickZone = (node: ZoneNode) => {
    setNearMe(false);
    setSelectedZoneId(node.id);
    if (node.children?.length) {
      setPathIds((ids) => [...ids, node.id]);
    }
  };

  const jumpTo = (depth: number) => setPathIds((ids) => ids.slice(0, depth));

  const toggleCategory = (slug: string) => {
    setCategorySlugs((slugs) =>
      slugs.includes(slug)
        ? slugs.filter((s) => s !== slug)
        : [...slugs, slug],
    );
  };

  const reset = () => {
    setNearMe(true);
    setSelectedZoneId(null);
    setPathIds([]);
    setWhenNow(true);
    setHour(new Date().getHours());
    setCategorySlugs([]);
    setRandomness(DEFAULT_RANDOMNESS);
  };

  const whereSummary = nearMe
    ? "Near me"
    : (selectedZone?.name ?? "Anywhere");
  const whatSummary =
    categorySlugs.length === 0
      ? "All"
      : categorySlugs.length === 1
        ? (FILTER_CATEGORIES.find((c) => c.slug === categorySlugs[0])?.label ??
          "1 selected")
        : `${categorySlugs.length} selected`;

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header — tinted icon circle + Reset ghost + close. */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <p className="font-display text-base leading-tight font-semibold">
            Filters
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium transition"
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

      <div className="scrollbar-hide min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-1 pb-4">
        {/* ---- Where ------------------------------------------------- */}
        <Section icon={MapPin} label="Where" value={whereSummary}>
          <button
            type="button"
            onClick={() => setNearMe(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]",
              nearMe
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                nearMe
                  ? "bg-pink-gradient text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <LocateFixed className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Near me</span>
              <span className="text-muted-foreground block text-[11px]">
                Use my current location
              </span>
            </span>
            <span
              className={cn(
                "h-4 w-4 shrink-0 rounded-full border-2 transition",
                nearMe ? "border-primary bg-primary" : "border-border",
              )}
              aria-hidden="true"
            />
          </button>

          {/* Breadcrumb — Anywhere › México › Nuevo León. Tapping a crumb
              pops the drill back to that level. */}
          <div className="scrollbar-hide -mx-4 mt-3 flex items-center gap-1 overflow-x-auto px-4 text-[11px] font-semibold whitespace-nowrap">
            <button
              type="button"
              onClick={() => jumpTo(0)}
              className={cn(
                "shrink-0 rounded-full px-2 py-1 transition",
                path.length === 0
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🌎 Anywhere
            </button>
            {path.map((node, i) => (
              <span key={node.id} className="flex shrink-0 items-center gap-1">
                <ChevronRight className="text-muted-foreground/50 h-3 w-3" />
                <button
                  type="button"
                  onClick={() => jumpTo(i + 1)}
                  className={cn(
                    "rounded-full px-2 py-1 transition",
                    i === path.length - 1
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {node.name}
                </button>
              </span>
            ))}
          </div>

          {/* Current level — "All <level>" first once drilled, then the
              children; chips with children drill deeper on tap. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {level ? (
              <Chip
                active={!nearMe && selectedZoneId === level.id}
                onClick={() => {
                  setNearMe(false);
                  setSelectedZoneId(level.id);
                }}
              >
                All {level.name}
              </Chip>
            ) : (
              <Chip
                active={!nearMe && selectedZoneId === null}
                onClick={() => {
                  setNearMe(false);
                  setSelectedZoneId(null);
                }}
              >
                Anywhere
              </Chip>
            )}
            {options.map((node) => (
              <Chip
                key={node.id}
                active={!nearMe && selectedZoneId === node.id}
                onClick={() => pickZone(node)}
                trailing={
                  node.children?.length ? (
                    <ChevronRight className="-mr-1 h-3.5 w-3.5 opacity-60" />
                  ) : null
                }
              >
                {node.name}
              </Chip>
            ))}
          </div>
          {level && (
            <p className="text-muted-foreground/70 mt-2 text-[10px] font-medium tracking-wide uppercase">
              {ZONE_KIND_LABELS[options[0]?.kind ?? "zone"]}s in {level.name}
            </p>
          )}
        </Section>

        {/* ---- When -------------------------------------------------- */}
        <Section
          icon={Clock}
          label="When"
          value={whenNow ? "Now" : formatHourLabel(hour)}
        >
          <div className="flex items-center gap-3">
            <Chip active={whenNow} onClick={() => {
              setWhenNow(true);
              setHour(new Date().getHours());
            }}>
              Now
            </Chip>
            <span
              className={cn(
                "font-display ml-auto text-lg font-semibold tabular-nums transition",
                whenNow && "text-muted-foreground/60",
              )}
            >
              {formatHourLabel(hour)}
            </span>
          </div>
          <GradientRange
            min={0}
            max={23}
            value={hour}
            ariaLabel="Hour of day"
            dimmed={whenNow}
            onChange={(next) => {
              setWhenNow(false);
              setHour(next);
            }}
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
        <Section icon={Tag} label="What" value={whatSummary}>
          {/* Two-row horizontal chip grid keeps 20+ categories browsable
              without turning the sheet into a wall. Multi-select; empty
              selection = All. */}
          <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
            <div className="grid w-max grid-flow-col grid-rows-2 gap-2">
              <Chip
                active={categorySlugs.length === 0}
                onClick={() => setCategorySlugs([])}
              >
                ✨ All
              </Chip>
              {FILTER_CATEGORIES.map((category) => (
                <Chip
                  key={category.slug}
                  active={categorySlugs.includes(category.slug)}
                  onClick={() => toggleCategory(category.slug)}
                >
                  {category.label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        {/* ---- Randomness -------------------------------------------- */}
        <Section
          icon={Dices}
          label="Randomness"
          value={`${randomness} · ${randomnessLabel(randomness)}`}
        >
          <GradientRange
            min={1}
            max={10}
            value={randomness}
            ariaLabel="Randomness level"
            onChange={setRandomness}
          />
          <div className="text-muted-foreground mt-1.5 flex items-baseline justify-between text-[11px] font-medium">
            <span>Play it safe</span>
            <span className="text-foreground">
              {randomnessLabel(randomness)}
            </span>
            <span>Surprise me</span>
          </div>
        </Section>
      </div>

      {/* Footer CTA — presentational for now: applying just closes the
          sheet (selections persist via keepMounted). */}
      <div className="border-border/60 shrink-0 border-t p-4">
        <button
          type="button"
          onClick={onClose}
          className="bg-pink-gradient shadow-glow flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          Show places
        </button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-1.5">
        <Icon className="text-secondary h-3.5 w-3.5 shrink-0 self-center" />
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        {value && (
          <span className="text-primary ml-auto max-w-[55%] truncate text-xs font-semibold">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Chip({
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
        "flex shrink-0 items-center gap-1 rounded-lg border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition active:scale-[0.97]",
        active
          ? "bg-pink-gradient border-transparent text-white shadow-sm"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
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
