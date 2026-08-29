"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_SEARCH_STOPS,
  searchPowerCaption,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import { cn } from "@/lib/utils";

// Exclusive Places scope — same format as admin Discovery Map
// "Reload after": a wrap of exclusive pills, not a slider. Partners ⊂
// + Places ⊂ + Google. Default is + Places. Mesita Places is enriched
// only.

export function SearchPlacesScope({
  power,
  onPower,
}: {
  power: MapSearchPower;
  onPower: (power: MapSearchPower) => void;
}) {
  const selected =
    MAP_SEARCH_STOPS.find((stop) => stop.power === power) ?? MAP_SEARCH_STOPS[1];

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
    <div className="flex flex-col">
      <p className="text-muted-foreground mb-2 type-meta">{selected.hint}</p>
      <div
        role="radiogroup"
        aria-label="Places"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {MAP_SEARCH_STOPS.map((stop) => {
          const active = power === stop.power;
          return (
            <button
              key={stop.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={searchPowerCaption(stop.power)}
              onClick={() => onPower(stop.power)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-lg px-3.5 type-body tabular-nums transition",
                active
                  ? "bg-foreground text-background font-bold"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted border font-semibold",
              )}
            >
              {stop.tick}
            </button>
          );
        })}
      </div>
    </div>
  );
}
