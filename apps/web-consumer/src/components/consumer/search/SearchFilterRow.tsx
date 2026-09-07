"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's one chrome control, TOP RIGHT, BESIDE THE BAR (Pato, 2026-09-06).
//
// It has been four places in a week — top row labelled, off the canvas, down
// on the bottom overlay next to the count, then back up here as a disc. Down
// there it was reachable but it was also stuck to the rail: on an empty
// viewport it rode a small "No places to show here yet" card at the bottom of
// the screen, which is the one moment a guest is looking for a way to widen
// the search and the last place they look for it. Chrome that edits the map
// belongs on the map's own chrome row.
//
// A THIRD OF THE ROW, LABELLED — and that REVERSES the disc (Pato,
// MESITA-1627, live instruction: "make the filter button larger. maybe one
// third"). PR #1572 argued "A CIRCLE, NOT A PILL": the corner spent no width
// the query needed, and a labelled button beside a full-width field competes
// with it for the same glance. The competition was the point being conceded —
// on a map with an empty catalog, Filters is not chrome beside the query, it
// is the other half of the question, so it now reads as the query's peer. The
// width argument is answered by the split rather than dismissed: at
// `basis-1/3` the bar still holds two thirds of a 351px row (~226px), which
// is more than the placeholder needs.
//
// IT WEARS THE BAR'S CHROME, which is what the pre-#1572 pill got wrong and
// what the disc got right: same 44px height, same border, same `shadow-elev`,
// same blur. Two controls, one row — not a field and a shouting button.
//
// `basis-1/3` + `shrink-0` IS THE ANTI-DISAPPEARING PAIR (Pato, MESITA-1627:
// "when clicking searchbar, it expands and covers filter and filter
// disapears"). A focused bar that grows past its track and eats its sibling
// is what a missing `min-w-0` on the bar's wrapper or a missing `shrink-0`
// here produces — flex would resolve the overflow by shrinking whichever
// child can shrink, and an unprotected 44px disc can shrink to nothing while
// still being in the DOM, which is exactly what "it disappears" looks like.
// Neither class is cosmetic; `search-overlays.test.tsx` pins both, and the
// bar's wrapper keeps `min-w-0 flex-1` in SearchClient for the same reason.
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
      <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
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
