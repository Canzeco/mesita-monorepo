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

// Tinder-style action rail: circular buttons, each with its own ring colour,
// centred under the card rather than a full-width row of rounded squares.
//
// Two sizes carry the hierarchy the old equal-width row flattened — Skip and
// Save are the deck's real verbs and read big; Filters / Info / Reserve are
// utilities and sit small on either side. Same five handlers as before, same
// labels, same filters dot.

type Tone = "amber" | "rose" | "sky" | "pink" | "violet";

// Ring + glyph per action. Kept as whole class strings (never interpolated)
// so Tailwind's scanner sees every one of them.
const TONE: Record<Tone, string> = {
  amber: "border-amber-400/70 text-amber-500 hover:bg-amber-50",
  rose: "border-rose-400/70 text-rose-500 hover:bg-rose-50",
  sky: "border-sky-400/70 text-sky-500 hover:bg-sky-50",
  pink: "border-primary/70 text-primary hover:bg-primary/8",
  violet: "border-violet-400/70 text-violet-500 hover:bg-violet-50",
};

function SwipeActionButton({
  label,
  Icon,
  tone,
  big,
  onClick,
  filled,
  showDot,
  className,
}: {
  label: string;
  Icon: LucideIcon;
  tone: Tone;
  /** The two primary verbs (Skip / Save) render one step larger. */
  big?: boolean;
  onClick: () => void;
  /** Solid glyph — the saved heart. */
  filled?: boolean;
  /** Red status dot: filters deviate from defaults (MESITA-633). */
  showDot?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "bg-card relative grid shrink-0 place-items-center rounded-full border-2",
        "shadow-[0_2px_10px_-3px_rgba(80,20,40,0.25)] transition",
        "active:scale-90 motion-reduce:active:scale-100",
        big ? "h-15 w-15" : "h-12 w-12",
        TONE[tone],
        className,
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
        tone="amber"
        onClick={onOpenFilters}
        showDot={filtersActive}
      />
      <SwipeActionButton
        label="Skip"
        Icon={X}
        tone="rose"
        big
        onClick={onSkip}
      />
      <SwipeActionButton
        label="About this place"
        Icon={Store}
        tone="sky"
        onClick={onOpenInfo}
      />
      <SwipeActionButton
        label={saved ? "Saved" : "Save"}
        Icon={Heart}
        tone="pink"
        big
        onClick={onSave}
        filled={saved}
        className={saved ? "bg-primary/10" : undefined}
      />
      <SwipeActionButton
        label="Reserve a table"
        Icon={CalendarCheck}
        tone="violet"
        onClick={onReserve}
      />
    </div>
  );
}
