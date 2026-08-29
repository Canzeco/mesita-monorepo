"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_SEARCH_STOPS,
  searchPowerCaption,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import { cn } from "@/lib/utils";

// Exclusive Places scope — not a slider. Partners ⊂ + Places ⊂ + Google.
// One tap picks a nested union. Default is + Places. Mesita Places is
// enriched only.

export function SearchPlacesScope({
  power,
  onPower,
}: {
  power: MapSearchPower;
  onPower: (power: MapSearchPower) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MAP_SEARCH_STOPS.findIndex((stop) => stop.power === power);
    const last = MAP_SEARCH_STOPS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onPower(MAP_SEARCH_STOPS[Math.min(index + 1, last)]!.power);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onPower(MAP_SEARCH_STOPS[Math.max(index - 1, 0)]!.power);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onPower(MAP_SEARCH_STOPS[0]!.power);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onPower(MAP_SEARCH_STOPS[last]!.power);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Places"
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1.5"
    >
      {MAP_SEARCH_STOPS.map((stop) => {
        const selected = power === stop.power;
        return (
          <button
            key={stop.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={searchPowerCaption(stop.power)}
            onClick={() => onPower(stop.power)}
            className={cn(
              "flex min-h-11 w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
              selected
                ? "border-primary bg-primary/8"
                : "border-border hover:bg-muted/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-primary" : "border-muted-foreground/35",
              )}
            >
              {selected ? (
                <span className="bg-primary h-2.5 w-2.5 rounded-full" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="font-display text-foreground block text-sm leading-snug font-semibold">
                {stop.tick}
              </span>
              <span className="type-meta text-muted-foreground mt-0.5 block leading-snug">
                {stop.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
