"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's one chrome control, TOP RIGHT, BESIDE THE BAR (Pato, 2026-09-12:
// "return to filters button at the top right", then "must be one third").
//
// A THIRD OF THE ROW, LABELLED — and that REVERSES the disc MESITA-1790
// restored (Pato, MESITA-1797: "the filters button must be larger, must be
// one third, and the search bar must be two thirds"). #1737 argued a
// labelled third competed with the query for the same glance; that
// competition is the point being conceded — on a map with an empty
// catalog, Filters is the other half of the question, not chrome beside it.
// The width argument is answered by the split: at `basis-1/3` the bar
// still holds two thirds.
//
// IT WEARS THE BAR'S CHROME: same 44px height, same border, same
// `shadow-elev`, same blur. Two controls, one row.
//
// `basis-1/3` + `shrink-0` IS THE ANTI-DISAPPEARING PAIR. A focused bar that
// grows past its track and eats its sibling is what a missing `min-w-0`
// on the bar's wrapper or a missing `shrink-0` here produces. Neither class
// is cosmetic; `search-overlays.test.tsx` pins both, and the bar's wrapper
// keeps `min-w-0 flex-1` in SearchClient for the same reason.
//
// Applied goes primary-filled with the count inline: the state is legible
// before the sheet opens, and at this width it can be a number beside the
// word instead of a badge clipped to the corner.
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
      aria-label={applied ? `Filters, ${count} applied` : "Filter places"}
      aria-haspopup="dialog"
      aria-pressed={applied}
      className={cn(
        "shadow-elev flex h-11 shrink-0 basis-1/3 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-semibold backdrop-blur-xl transition active:scale-[0.97]",
        applied
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card/95 text-foreground",
      )}
    >
      <SlidersHorizontal
        className="h-4 w-4 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="truncate">Filters</span>
      {applied && (
        <span
          className={cn(
            "type-label flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 leading-none font-bold tabular-nums",
            "bg-primary-foreground/20 text-primary-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
