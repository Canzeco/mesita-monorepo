"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The Filters control, TOP RIGHT, BESIDE THE BAR: a 44px disc wearing the
// sliders icon and nothing else (Pato, 2026-10-17: "don't mention filters
// as text, just the filters icon is enough and universal"). That retires
// the labelled third of MESITA-1797; the row is now location · bar ·
// filters, and the bar takes everything the two discs leave.
//
// IT WEARS THE BAR'S CHROME: same 44px height, same border, same
// `shadow-elev`, same blur. Three controls, one row.
//
// `shrink-0` IS THE ANTI-DISAPPEARING CLASS. A focused bar that grows past
// its track and eats its siblings is what a missing `min-w-0` on the bar's
// wrapper or a missing `shrink-0` here produces. Neither is cosmetic;
// `search-overlays.test.tsx` pins both.
//
// Applied goes primary-filled with the count as a corner badge: the state
// is legible before the sheet opens. The accessible name carries the word
// the disc no longer prints.
export function SearchFilterRow({
  count,
  onOpenFilters,
}: {
  count: number;
  onOpenFilters: () => void;
}) {
  const applied = count > 0;
  return (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-label={applied ? `Filters, ${count} applied` : "Filters"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className={cn(
        "shadow-elev relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.97]",
        applied
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card/95 text-foreground",
      )}
    >
      <SlidersHorizontal
        className="h-5 w-5 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
      {applied && (
        <span
          className={cn(
            "type-label absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 leading-none font-bold tabular-nums",
            "border-background bg-foreground text-paper",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
