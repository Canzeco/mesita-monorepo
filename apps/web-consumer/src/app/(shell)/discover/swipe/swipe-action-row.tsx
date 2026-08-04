"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  Heart,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// The deck's action rail: circular, centred under the card.
//
// COLOUR IS NOT DECORATION HERE. The first pass gave each button its own hue
// (amber / rose / sky / pink / violet) and it read cheap for three measurable
// reasons, all fixed below:
//
//   1. Every token in this app lives in one narrow warm band — `--background`
//      is oklch(.985 .012 10), primary hue 5, muted hue 10, border hue 10.
//      Amber (~85), sky (~230) and violet (~290) are 75-280° away from
//      anything else in the product. An imported palette, not ours.
//   2. Skip (#ff2357) and Save (#fb2b7b) were hue TWINS — the two most
//      consequential controls, opposite in meaning, looking like a pair.
//   3. Five equally saturated rings cancelled the size hierarchy: sizing two
//      buttons up says "these matter", colouring all five equally says
//      "everything matters".
//
// So: the three utilities recede to neutral, Skip is neutral but heavier, and
// Save is the ONLY colour in the row. Hierarchy comes from weight and fill,
// which is what a light-theme surface actually has to work with — Tinder's
// neon reads as neon because it sits on black, and copying the hues without
// the surface copies the look while missing the logic.

type Variant = "utility" | "skip" | "save";

function SwipeActionButton({
  label,
  Icon,
  variant,
  onClick,
  filled,
  showDot,
}: {
  label: string;
  Icon: LucideIcon;
  variant: Variant;
  onClick: () => void;
  /** Solid glyph — the saved heart. */
  filled?: boolean;
  /** Red status dot: filters deviate from defaults (MESITA-633). */
  showDot?: boolean;
}) {
  const big = variant !== "utility";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-2 transition",
        "active:scale-90 motion-reduce:active:scale-100",
        big ? "h-15 w-15" : "h-12 w-12",
        variant === "utility" &&
          "border-border bg-card text-muted-foreground hover:bg-muted shadow-[0_2px_8px_-4px_rgba(80,20,40,0.25)]",
        // Heavier than the utilities, still no hue — Skip is a decision, not
        // an error, so it must not read as destructive red.
        variant === "skip" &&
          "border-foreground/25 bg-card text-foreground/80 hover:bg-muted shadow-[0_2px_10px_-4px_rgba(80,20,40,0.3)]",
        // The one colour. Solid, so it wins the row outright.
        variant === "save" &&
          "border-primary bg-primary text-primary-foreground shadow-[0_5px_16px_-5px_rgba(251,43,123,0.65)] hover:brightness-105",
      )}
    >
      <Icon
        className={cn(big ? "h-7 w-7" : "h-5 w-5", filled && "fill-current")}
        strokeWidth={2.25}
      />
      {showDot ? (
        <span
          className="ring-card absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

type SwipeActionRowProps = {
  filtersActive: boolean;
  saved: boolean;
  onOpenFilters: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
  onReserve: () => void;
};

export function SwipeActionRow({
  filtersActive,
  saved,
  onOpenFilters,
  onSkip,
  onOpenInfo,
  onSave,
  onReserve,
}: SwipeActionRowProps) {
  return (
    <div className="mt-3 flex items-center justify-center gap-3.5">
      <SwipeActionButton
        label={filtersActive ? "Filters (active)" : "Filters"}
        Icon={SlidersHorizontal}
        variant="utility"
        onClick={onOpenFilters}
        showDot={filtersActive}
      />
      <SwipeActionButton label="Skip" Icon={X} variant="skip" onClick={onSkip} />
      <SwipeActionButton
        label="About this place"
        Icon={Store}
        variant="utility"
        onClick={onOpenInfo}
      />
      {/* The glyph fill carries the saved state — this button is already the
          row's only colour, so a second colour for "saved" would be noise. */}
      <SwipeActionButton
        label={saved ? "Saved" : "Save"}
        Icon={Heart}
        variant="save"
        onClick={onSave}
        filled={saved}
      />
      <SwipeActionButton
        label="Reserve a table"
        Icon={CalendarCheck}
        variant="utility"
        onClick={onReserve}
      />
    </div>
  );
}
