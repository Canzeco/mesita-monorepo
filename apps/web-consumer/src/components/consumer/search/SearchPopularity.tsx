"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_MIN_REVIEW_STOPS,
  type MapMinReviews,
} from "@/lib/map-filters-engine";
import { cn } from "@/lib/utils";

// Popularity — exclusive 0 / 10 / 100 / 1k / 10k Google reviews.
// Discovery-mode artificial filter (Pato, 2026-09-12): the Map mode
// drops trash AFTER the catalog is assembled, never as a Nearby API
// param. 0 is any. How many (pin cap) is operator config, not this.

const STOP_LABEL: Record<MapMinReviews, string> = {
  0: "0",
  10: "10",
  100: "100",
  1000: "1k",
  10000: "10k",
};

export function SearchPopularity({
  minReviews,
  onMinReviews,
}: {
  minReviews: MapMinReviews;
  onMinReviews: (min: MapMinReviews) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MAP_MIN_REVIEW_STOPS.indexOf(minReviews);
    const last = MAP_MIN_REVIEW_STOPS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onMinReviews(MAP_MIN_REVIEW_STOPS[Math.min(index + 1, last)]!);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onMinReviews(MAP_MIN_REVIEW_STOPS[Math.max(index - 1, 0)]!);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onMinReviews(MAP_MIN_REVIEW_STOPS[0]!);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onMinReviews(MAP_MIN_REVIEW_STOPS[last]!);
    }
  };

  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground mb-1.5 type-meta">
        {minReviews === 0
          ? "Any Google review count."
          : `At least ${minReviews.toLocaleString()} Google reviews.`}
      </p>
      <div
        role="radiogroup"
        aria-label="Popularity"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="border-border flex overflow-hidden rounded-xl border"
      >
        {MAP_MIN_REVIEW_STOPS.map((stop, index) => {
          const active = minReviews === stop;
          return (
            <button
              key={stop}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={
                stop === 0
                  ? "Any Google reviews"
                  : `At least ${stop.toLocaleString()} Google reviews`
              }
              onClick={() => onMinReviews(stop)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center px-1 text-center type-meta whitespace-nowrap tabular-nums transition",
                index > 0 && "border-border border-l",
                active
                  ? "bg-foreground text-background font-bold"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
              )}
            >
              {STOP_LABEL[stop]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
