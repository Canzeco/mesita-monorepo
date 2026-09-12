"use client";

import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

// The map's one chrome control, TOP RIGHT, BESIDE THE BAR (Pato, 2026-09-12:
// "return to filters button at the top right").
//
// A CIRCLE, NOT A PILL. The row is the bar's. A labelled third of the row
// (MESITA-1627) competed with the query for the same glance; a disc takes
// the corner, spends no width the query needs, and matches the /search
// loading silhouette (`h-12 w-12` circle). Same 44px height, border,
// `shadow-elev` and blur as SearchBar — two controls, one row.
//
// Applied goes primary-filled with the count on the disc.
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
