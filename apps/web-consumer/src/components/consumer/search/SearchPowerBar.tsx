"use client";

import {
  MAP_SEARCH_POWER_MAX,
  MAP_SEARCH_POWER_MIN,
  MAP_SEARCH_STOPS,
  searchPowerCaption,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import { RangeSlider } from "@/components/consumer/discovery-filter-controls";
import { cn } from "@/lib/utils";

// Cumulative search-source power. Guests pick a depth, not a chip set:
// Partners ⊂ Partners & Places ⊂ Partners & Places & Google.
// Mesita Places is enriched only.

export function SearchPowerBar({
  power,
  onPower,
}: {
  power: MapSearchPower;
  onPower: (power: MapSearchPower) => void;
}) {
  const caption = searchPowerCaption(power);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-foreground text-sm leading-snug font-semibold">
        {caption}
      </p>
      <RangeSlider
        min={MAP_SEARCH_POWER_MIN}
        max={MAP_SEARCH_POWER_MAX}
        step={1}
        value={power}
        ariaLabel={caption}
        onChange={(n) => onPower(n as MapSearchPower)}
      />
      <div className="flex justify-between gap-1">
        {MAP_SEARCH_STOPS.map((stop) => {
          const active = power >= stop.power;
          return (
            <button
              key={stop.key}
              type="button"
              onClick={() => onPower(stop.power)}
              aria-pressed={power === stop.power}
              aria-label={searchPowerCaption(stop.power)}
              className={cn(
                "type-meta min-h-11 min-w-0 flex-1 px-0.5 text-center font-semibold tracking-wide transition",
                active ? "text-foreground" : "text-muted-foreground/70",
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
