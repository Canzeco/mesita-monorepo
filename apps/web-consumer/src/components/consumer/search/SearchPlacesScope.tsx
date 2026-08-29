"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle } from "lucide-react";
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

// Exclusive Places scope as nested sets: Partners ⊂ Mesita Places ⊂
// Google. The diagram is display-only — never a hit target. The legend
// pills are the radios. Default is + Places (middle). Flat pin colors only.

const CX = 52;
const SIZE = CX * 2;
const R_PARTNER = 15;
const R_PLACES = 26;
const R_GOOGLE = 40;

const VENN_LAYERS = [
  {
    power: 3 as const,
    radius: R_GOOGLE,
    color: MAP_GOOGLE_PIN_COLOR,
  },
  {
    power: 2 as const,
    radius: R_PLACES,
    color: MAP_LISTED_PIN_COLOR,
  },
  {
    power: 1 as const,
    radius: R_PARTNER,
    color: MAP_PARTNER_PIN_COLOR,
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

      <figure
        className="pointer-events-none mx-auto select-none"
        style={{ width: SIZE, height: SIZE }}
        aria-hidden
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
          {[...VENN_LAYERS].reverse().map((layer) => {
            const included = power >= layer.power;
            const selectedRing = power === layer.power;
            return (
              <circle
                key={layer.power}
                cx={CX}
                cy={CX}
                r={layer.radius}
                fill={included ? layer.color : "none"}
                stroke={layer.color}
                strokeWidth={selectedRing ? 2 : 1.5}
                strokeOpacity={included ? 1 : 0.28}
              />
            );
          })}
        </svg>
      </figure>

      <div
        role="radiogroup"
        aria-label="Places"
        onKeyDown={onKeyDown}
        className="mt-3 grid w-full grid-cols-3 gap-1.5"
      >
        {MAP_SEARCH_STOPS.map((stop) => {
          const active = power === stop.power;
          const layer = VENN_LAYERS.find((item) => item.power === stop.power)!;
          return (
            <button
              key={stop.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={searchPowerCaption(stop.power)}
              tabIndex={active ? 0 : -1}
              onClick={() => onPower(stop.power)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition",
                "focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "border-foreground/15 bg-card text-foreground border"
                  : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
              )}
              style={
                active ? { borderColor: layer.color, borderWidth: 2 } : undefined
              }
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{
                  backgroundColor: layer.color,
                  opacity: active ? 1 : 0.45,
                }}
                aria-hidden
              />
              <span className="type-meta font-semibold tracking-tight">
                {stop.tick}
              </span>
            </button>
          );
        })}
      </div>

      {power === 3 ? (
        <div
          role="alert"
          className="border-amber-500/40 bg-amber-500/10 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5"
        >
          <AlertTriangle
            className="size-4 shrink-0 text-amber-600"
            aria-hidden
          />
          <p className="type-meta font-semibold tracking-wide text-amber-900">
            ALL GOOGLE PLACES
          </p>
        </div>
      ) : null}
    </div>
  );
}
