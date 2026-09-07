"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's one chrome control, TOP RIGHT, BESIDE THE BAR (Pato, 2026-09-06).
//
// It has been three places in a week — top row labelled, off the canvas, then
// down on the bottom overlay next to the count. Down there it was reachable
// but it was also stuck to the rail: on an empty viewport it rode a small
// "No places to show here yet" card at the bottom of the screen, which is the
// one moment a guest is looking for a way to widen the search and the last
// place they look for it. Chrome that edits the map belongs on the map's own
// chrome row.
//
// A CIRCLE, NOT A PILL. The row is the bar's, and the bar is the reason the
// pill kept escalating — a labelled button beside a full-width field competes
// with it for the same glance. A disc takes the corner, spends no width the
// query needs, and reads as a control rather than a second field.
//
// IT WEARS THE BAR'S CHROME, which is what the earlier disc got wrong: that
// one was `bg-card/95` + a soft `shadow-rest` and nothing else, so a pale
// translucent circle on a pale basemap was camouflage. Same border, same
// `shadow-elev`, same blur, same 44px height as SearchBar — the two read as
// one row of two controls, and the disc is as visible as the field is.
//
// Applied goes primary-filled with the count on the disc: the state is legible
// before the sheet opens, without a badge that only appears once it is on.
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
        "shadow-elev relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-xl transition active:scale-[0.97]",
        applied
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card/95 text-foreground",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      {applied && (
        <span className="bg-primary text-primary-foreground border-card type-meta absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border px-1 leading-none font-bold tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
