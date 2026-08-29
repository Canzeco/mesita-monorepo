"use client";

import { useId, type KeyboardEvent } from "react";
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
// pills are the radios. Default is + Places (middle). Colors match map pins.

const CX = 88;
const SIZE = CX * 2;
const R_PARTNER = 28;
const R_PLACES = 52;
const R_GOOGLE = 76;

const VENN_LAYERS = [
  {
    power: 3 as const,
    outer: R_GOOGLE,
    inner: R_PLACES,
    color: MAP_GOOGLE_PIN_COLOR,
  },
  {
    power: 2 as const,
    outer: R_PLACES,
    inner: R_PARTNER,
    color: MAP_LISTED_PIN_COLOR,
  },
  {
    power: 1 as const,
    outer: R_PARTNER,
    inner: 0,
    color: MAP_PARTNER_PIN_COLOR,
  },
] as const;

function annulusPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): string {
  if (inner <= 0) {
    return [
      `M ${cx - outer} ${cy}`,
      `a ${outer} ${outer} 0 1 0 ${outer * 2} 0`,
      `a ${outer} ${outer} 0 1 0 ${-outer * 2} 0`,
    ].join(" ");
  }
  return [
    `M ${cx - outer} ${cy}`,
    `a ${outer} ${outer} 0 1 0 ${outer * 2} 0`,
    `a ${outer} ${outer} 0 1 0 ${-outer * 2} 0`,
    `M ${cx - inner} ${cy}`,
    `a ${inner} ${inner} 0 1 1 ${inner * 2} 0`,
    `a ${inner} ${inner} 0 1 1 ${-inner * 2} 0`,
  ].join(" ");
}

function bandFillOpacity(power: MapSearchPower, layerPower: MapSearchPower) {
  if (power < layerPower) return 0.045;
  if (layerPower === 1) return 0.96;
  if (layerPower === 2) return 0.74;
  return 0.52;
}

export function SearchPlacesScope({
  power,
  onPower,
}: {
  power: MapSearchPower;
  onPower: (power: MapSearchPower) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const selected =
    MAP_SEARCH_STOPS.find((stop) => stop.power === power) ?? MAP_SEARCH_STOPS[1];
  const includedOuter =
    power >= 3 ? R_GOOGLE : power >= 2 ? R_PLACES : R_PARTNER;

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
      <p className="text-muted-foreground mb-4 type-meta">{selected.hint}</p>

      <figure
        className="pointer-events-none mx-auto select-none"
        style={{ width: SIZE, height: SIZE }}
        aria-hidden
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          className="block overflow-visible"
        >
          <defs>
            <filter
              id={`places-venn-soft-${uid}`}
              x="-18%"
              y="-18%"
              width="136%"
              height="136%"
            >
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="5"
                floodColor="#1a1214"
                floodOpacity="0.14"
              />
            </filter>
            <radialGradient
              id={`places-venn-sheen-${uid}`}
              cx="36%"
              cy="30%"
              r="72%"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="42%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle
            cx={CX}
            cy={CX}
            r={R_GOOGLE + 6}
            fill="#f6f3ef"
          />
          <g filter={`url(#places-venn-soft-${uid})`}>
            {VENN_LAYERS.map((layer) => {
              const included = power >= layer.power;
              const selectedRing = power === layer.power;
              return (
                <path
                  key={`band-${layer.power}`}
                  d={annulusPath(CX, CX, layer.outer, layer.inner)}
                  fill={layer.color}
                  fillOpacity={bandFillOpacity(power, layer.power)}
                  fillRule="evenodd"
                  stroke={layer.color}
                  strokeWidth={selectedRing ? 2.6 : included ? 1.35 : 1.15}
                  strokeOpacity={included ? 0.95 : 0.22}
                />
              );
            })}
          </g>
          <circle
            cx={CX}
            cy={CX}
            r={R_PLACES}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.7}
            strokeWidth={1.5}
          />
          <circle
            cx={CX}
            cy={CX}
            r={R_PARTNER}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.8}
            strokeWidth={1.5}
          />
          <circle
            cx={CX}
            cy={CX}
            r={includedOuter}
            fill={`url(#places-venn-sheen-${uid})`}
          />
        </svg>
      </figure>

      <div
        role="radiogroup"
        aria-label="Places"
        onKeyDown={onKeyDown}
        className="mt-5 grid w-full grid-cols-3 gap-2"
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
                "flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-2.5 text-center transition",
                "focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "bg-white text-foreground"
                  : "bg-muted/45 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              style={
                active
                  ? {
                      boxShadow: `0 0 0 2px ${layer.color}, 0 8px 18px rgba(26,18,20,0.08)`,
                    }
                  : undefined
              }
            >
              <span
                className="inline-block size-2.5 rounded-full"
                style={{
                  backgroundColor: layer.color,
                  boxShadow: active
                    ? "0 0 0 2px #fff, 0 0 0 3px rgba(26,18,20,0.08)"
                    : undefined,
                  opacity: active ? 1 : 0.55,
                }}
                aria-hidden
              />
              <span className="type-body font-semibold tracking-tight">
                {stop.tick}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
