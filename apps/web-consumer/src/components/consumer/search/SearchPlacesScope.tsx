"use client";

import type { KeyboardEvent } from "react";
import {
  MAP_SEARCH_STOPS,
  searchPowerCaption,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_LISTED_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
} from "@/lib/map-defaults";
import { cn } from "@/lib/utils";

// Exclusive Places scope as a nested Venn: Partners ⊂ Mesita Places ⊂
// Google. Tap a ring to widen; included inner rings stay filled. Default
// is + Places (middle). Colors match map pins.

const R_PARTNER = 22;
const R_PLACES = 38;
const R_GOOGLE = 54;
const SIZE = R_GOOGLE * 2;

const VENN_LAYERS = [
  {
    power: 3 as const,
    radius: R_GOOGLE,
    stroke: MAP_GOOGLE_PIN_COLOR,
    fill: MAP_GOOGLE_PIN_COLOR,
    z: 10,
  },
  {
    power: 2 as const,
    radius: R_PLACES,
    stroke: MAP_LISTED_PIN_COLOR,
    fill: MAP_LISTED_PIN_COLOR,
    z: 20,
  },
  {
    power: 1 as const,
    radius: R_PARTNER,
    stroke: MAP_PARTNER_PIN_COLOR,
    fill: MAP_PARTNER_PIN_COLOR,
    z: 30,
  },
] as const;

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
      <p className="text-muted-foreground mb-3 type-meta">{selected.hint}</p>
      <div
        role="radiogroup"
        aria-label="Places"
        onKeyDown={onKeyDown}
        className="flex flex-col items-center"
      >
        <div
          className="relative mx-auto"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            className="pointer-events-none absolute inset-0"
            aria-hidden
          >
            {VENN_LAYERS.map((layer) => {
              const included = power >= layer.power;
              const selectedRing = power === layer.power;
              return (
                <circle
                  key={`paint-${layer.power}`}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={layer.radius}
                  fill={included ? layer.fill : "transparent"}
                  fillOpacity={included ? (selectedRing ? 0.42 : 0.22) : 0}
                  stroke={layer.stroke}
                  strokeWidth={selectedRing ? 2.5 : 1.75}
                  strokeOpacity={included ? 1 : 0.45}
                />
              );
            })}
          </svg>

          {VENN_LAYERS.map((layer) => {
            const active = power === layer.power;
            const diameter = layer.radius * 2;
            return (
              <button
                key={layer.power}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={searchPowerCaption(layer.power)}
                onClick={(event) => {
                  event.stopPropagation();
                  onPower(layer.power);
                }}
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0",
                  "focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                )}
                style={{
                  width: diameter,
                  height: diameter,
                  zIndex: layer.z,
                }}
              />
            );
          })}
        </div>

        <div
          className="mt-3 flex w-full justify-between px-1"
          style={{ maxWidth: SIZE }}
        >
          {MAP_SEARCH_STOPS.map((stop) => {
            const active = power === stop.power;
            const layer = VENN_LAYERS.find((l) => l.power === stop.power)!;
            return (
              <button
                key={stop.key}
                type="button"
                onClick={() => onPower(stop.power)}
                className={cn(
                  "type-meta min-h-11 rounded-lg px-1 font-semibold transition",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="mr-1 inline-block size-2 rounded-full align-middle"
                  style={{
                    backgroundColor: layer.fill,
                    opacity: active ? 1 : 0.45,
                  }}
                  aria-hidden
                />
                {stop.tick}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
