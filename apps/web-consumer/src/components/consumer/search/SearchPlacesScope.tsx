"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_SEARCH_STOPS,
  searchPowerCaption,
  searchPowerIncludes,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import { cn } from "@/lib/utils";

// Nested Places scope — one meter, not three independent pills.
// Partners ⊂ Places ⊂ Google. Selecting a stop fills every stop
// inside it, so the control shows what you are seeing, not which
// chip you tapped. Default is Places. Mesita Places is enriched only.

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
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="border-border flex overflow-hidden rounded-xl border"
      >
        {MAP_SEARCH_STOPS.map((stop, index) => {
          const included = searchPowerIncludes(stop.power, power);
          const active = power === stop.power;
          return (
            <button
              key={stop.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={searchPowerCaption(stop.power)}
              data-included={included ? "true" : "false"}
              data-edge={active ? "true" : "false"}
              onClick={() => onPower(stop.power)}
              className={cn(
                "inline-flex min-h-12 flex-1 items-center justify-center px-1.5 text-center type-body whitespace-nowrap tabular-nums transition",
                index > 0 &&
                  (included ? "border-background/25 border-l" : "border-border border-l"),
                included
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                active ? "font-bold" : "font-semibold",
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
