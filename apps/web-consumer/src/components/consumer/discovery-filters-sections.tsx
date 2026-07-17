"use client";

import {
  ChevronRight,
  Clock,
  Dices,
  Globe,
  LocateFixed,
  MapPin,
  Tag,
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

/** Daypart glyph for the hour readout. */
function hourEmoji(hour: number): string {
  if (hour < 6) return "🌙";
  if (hour < 12) return "🌅";
  if (hour < 18) return "☀️";
  if (hour < 22) return "🌆";
  return "🌙";
}

export function WhereSection({
  nearMe,
  selectedZoneId,
  pathIds,
  onPatch,
}: {
  nearMe: boolean;
  selectedZoneId: string | null;
  pathIds: string[];
  onPatch: (partial: {
    nearMe?: boolean;
    selectedZoneId?: string | null;
    pathIds?: string[];
  }) => void;
}) {
  const path = pathIds
    .map((id) => findZoneTrail(id)?.at(-1))
    .filter((n): n is ZoneNode => !!n);
  const level = path.at(-1);
  const options = level?.children ?? ZONE_TREE;
  const selectedTrail = selectedZoneId ? findZoneTrail(selectedZoneId) : null;
  const selectedZone = selectedTrail?.at(-1) ?? null;

  const anywhere = !nearMe && selectedZoneId === null;
  const whereSummary = nearMe ? "Near me" : (selectedZone?.name ?? "Anywhere");
  const browseLabel = level
    ? `${ZONE_KIND_PLURAL_LABELS[options[0]?.kind ?? "zone"]} in ${level.name}`
    : "Browse by country";

  const pickZone = (node: ZoneNode) => {
    onPatch({
      nearMe: false,
      selectedZoneId: node.id,
      pathIds: node.children?.length ? [...pathIds, node.id] : pathIds,
    });
  };

  const jumpTo = (depth: number) => onPatch({ pathIds: pathIds.slice(0, depth) });

  return (
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
          active={nearMe}
          onClick={() => onPatch({ nearMe: true })}
        />
        <ModeCard
          icon={Globe}
          title="Anywhere"
          sub="No zone limit"
          active={anywhere}
          onClick={() => onPatch({ nearMe: false, selectedZoneId: null })}
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
            active={!nearMe && selectedZoneId === level.id}
            onClick={() => onPatch({ nearMe: false, selectedZoneId: level.id })}
          >
            All {level.name}
          </Pill>
        )}
        {options.map((node) => (
          <Pill
            key={node.id}
            active={!nearMe && selectedZoneId === node.id}
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
  );
}

export function WhenSection({
  whenNow,
  hour,
  onPatch,
}: {
  whenNow: boolean;
  hour: number;
  onPatch: (partial: { whenNow?: boolean; hour?: number }) => void;
}) {
  return (
    <Section
      icon={Clock}
      label="When"
      value={whenNow ? "Now" : formatHourLabel(hour)}
      tint={DISCOVERY_FILTER_TINTS.when}
    >
      <div className="flex items-center gap-3">
        <Pill
          active={whenNow}
          onClick={() => onPatch({ whenNow: true, hour: new Date().getHours() })}
        >
          Now
        </Pill>
        <span
          className={cn(
            "font-display ml-auto flex items-center gap-1.5 text-lg font-semibold tabular-nums transition",
            whenNow && "text-muted-foreground/60",
          )}
        >
          <span className="text-base" aria-hidden="true">
            {hourEmoji(hour)}
          </span>
          {formatHourLabel(hour)}
        </span>
      </div>
      <GradientRange
        min={0}
        max={23}
        value={hour}
        ariaLabel="Hour of day"
        dimmed={whenNow}
        onChange={(next) => onPatch({ whenNow: false, hour: next })}
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
  );
}

export function WhatSection({
  familyKeys,
  onPatch,
}: {
  familyKeys: FamilyKey[];
  onPatch: (partial: { familyKeys?: FamilyKey[] }) => void;
}) {
  const whatSummary =
    familyKeys.length === 0
      ? "All"
      : familyKeys.length === 1
        ? (placeFamilyByKey(familyKeys[0])?.label ?? "1 selected")
        : `${familyKeys.length} selected`;

  const toggleFamily = (key: FamilyKey) => {
    onPatch({
      familyKeys: familyKeys.includes(key)
        ? familyKeys.filter((k) => k !== key)
        : [...familyKeys, key],
    });
  };

  return (
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
        <Pill active={familyKeys.length === 0} onClick={() => onPatch({ familyKeys: [] })}>
          ✨ All
        </Pill>
        {PLACE_FAMILIES.map((family) => (
          <Pill
            key={family.key}
            active={familyKeys.includes(family.key)}
            onClick={() => toggleFamily(family.key)}
          >
            {family.emoji} {family.label}
          </Pill>
        ))}
      </div>
    </Section>
  );
}

export function RandomnessSection({
  randomness,
  onPatch,
}: {
  randomness: number;
  onPatch: (partial: { randomness?: number }) => void;
}) {
  return (
    <Section
      icon={Dices}
      label="Randomness"
      value={`${randomness} · ${randomnessLabel(randomness)}`}
      tint={DISCOVERY_FILTER_TINTS.random}
    >
      <GradientRange
        min={1}
        max={10}
        value={randomness}
        ariaLabel="Randomness level"
        onChange={(next) => onPatch({ randomness: next })}
      />
      <div className="text-muted-foreground mt-2 flex items-baseline justify-between text-[11px] font-medium">
        <span>🎯 Play it safe</span>
        <span className="text-foreground font-semibold">
          {randomnessLabel(randomness)}
        </span>
        <span>🎲 Surprise me</span>
      </div>
    </Section>
  );
}
