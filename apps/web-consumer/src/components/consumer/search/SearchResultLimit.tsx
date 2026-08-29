"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_RESULT_LIMITS,
  type MapResultLimit,
} from "@/lib/map-filters-engine";
import { cn } from "@/lib/utils";

// How many — exclusive 20 / 40 / 60. Separate from the Places Venn.
// Closest N after scope + Super. Nothing in between. It is the MAX, so
// the sheet opens at 20 and the guest asks for more.
//
// The line above the stops states the CAP AND THE REALITY in one
// sentence (Pato, 2026-08-29). "Closest 60 places." over a button
// reading "Show 20 places" reads as a broken control, and the guest is
// right: 60 is a ceiling, not a promise. Google's Nearby call returns at
// most 20 per call, so at Google scope the gap is the normal case. Both
// numbers now come from the same two values, so they cannot disagree.

export function SearchResultLimit({
  limit,
  onLimit,
  count,
}: {
  limit: MapResultLimit;
  onLimit: (limit: MapResultLimit) => void;
  /** Places that will actually appear. null while the catalog loads. */
  count?: number | null;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MAP_RESULT_LIMITS.indexOf(limit);
    const last = MAP_RESULT_LIMITS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onLimit(MAP_RESULT_LIMITS[Math.min(index + 1, last)]!);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onLimit(MAP_RESULT_LIMITS[Math.max(index - 1, 0)]!);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onLimit(MAP_RESULT_LIMITS[0]!);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onLimit(MAP_RESULT_LIMITS[last]!);
    }
  };

  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground mb-1.5 type-meta">
        {count == null || count >= limit
          ? `Closest ${limit} places.`
          : `Showing ${count} of up to ${limit} closest.`}
      </p>
      <div
        role="radiogroup"
        aria-label="How many"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="border-border flex overflow-hidden rounded-xl border"
      >
        {MAP_RESULT_LIMITS.map((stop, index) => {
          const active = limit === stop;
          return (
            <button
              key={stop}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Closest ${stop} places`}
              onClick={() => onLimit(stop)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center px-1.5 text-center type-meta whitespace-nowrap tabular-nums transition",
                index > 0 && "border-border border-l",
                active
                  ? "bg-foreground text-background font-bold"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
              )}
            >
              {stop}
            </button>
          );
        })}
      </div>
    </div>
  );
}
