"use client";

import type { KeyboardEvent } from "react";
import { TriangleAlert } from "lucide-react";
import {
  MAP_SEARCH_STOPS,
  type MapPlacesScope,
} from "@/lib/map-filters-engine";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_ENRICHED_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
} from "@/lib/map-defaults";
import { cn } from "@/lib/utils";

// Places scope — THREE NESTED SETS (Pato, 2026-09-05):
//
//   Google Places  ⊃  Mesita Enriched Places  ⊃  Mesita Partner Places
//      gray                    red                      yellow
//
// A superset chain, so the figure is CONCENTRIC RINGS (an Euler diagram),
// not overlapping circles. The rings are the whole point of the module:
// nothing else in the product says what the pin colours mean, and the
// guest is looking at those pins right now.
//
// THE FIGURE IS 28px AND SITS BESIDE THE LEGEND, not above it.
// Selected is a FILL, not a hairline. EACH ROW CARRIES ITS COUNT.

const SCOPE_COLOR: Record<MapPlacesScope, string> = {
  partners: MAP_PARTNER_PIN_COLOR,
  mesita: MAP_ENRICHED_PIN_COLOR,
  google: MAP_GOOGLE_PIN_COLOR,
};

const SCOPE_STROKE: Record<MapPlacesScope, string> = {
  partners: "#a37e00",
  mesita: "#c4123c",
  google: "#6b7280",
};

const GLYPH = 28;
const GLYPH_RADII: Record<MapPlacesScope, number> = {
  google: 12.5,
  mesita: 8.5,
  partners: 4.5,
};

/** The chain as one 28px figure: every ring drawn, the picked one filled. */
function ScopeGlyph({ scope }: { scope: MapPlacesScope }) {
  const mid = GLYPH / 2;
  return (
    <svg
      aria-hidden
      width={GLYPH}
      height={GLYPH}
      viewBox={`0 0 ${GLYPH} ${GLYPH}`}
      className="shrink-0"
    >
      {MAP_SEARCH_STOPS.map((stop) => {
        const inside = GLYPH_RADII[stop.key] <= GLYPH_RADII[scope];
        return (
          <circle
            key={stop.key}
            cx={mid}
            cy={mid}
            r={GLYPH_RADII[stop.key]}
            fill={inside ? SCOPE_COLOR[stop.key] : "none"}
            stroke={SCOPE_STROKE[stop.key]}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

export function SearchPlacesScope({
  scope,
  onScope,
  counts,
}: {
  scope: MapPlacesScope;
  onScope: (scope: MapPlacesScope) => void;
  /** Places each ring would show, from the catalog already in hand. */
  counts?: Partial<Record<MapPlacesScope, number>>;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MAP_SEARCH_STOPS.findIndex((stop) => stop.key === scope);
    const last = MAP_SEARCH_STOPS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onScope(MAP_SEARCH_STOPS[Math.min(index + 1, last)]!.key);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onScope(MAP_SEARCH_STOPS[Math.max(index - 1, 0)]!.key);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onScope(MAP_SEARCH_STOPS[0]!.key);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onScope(MAP_SEARCH_STOPS[last]!.key);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5">
        <ScopeGlyph scope={scope} />
        <p id="places-scope-chain" className="sr-only">
          Three nested sets: Google Places contains Mesita Enriched Places,
          which contains Mesita Partner Places.
        </p>
        <div
          role="radiogroup"
          aria-label="Places"
          aria-describedby="places-scope-chain"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-1 flex-col gap-1"
        >
          {MAP_SEARCH_STOPS.map((stop) => {
            const active = scope === stop.key;
            const count = counts?.[stop.key];
            return (
              <button
                key={stop.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={stop.hint}
                tabIndex={active ? 0 : -1}
                onClick={() => onScope(stop.key)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 type-meta whitespace-nowrap transition",
                  "focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  active
                    ? "border-foreground bg-foreground text-background font-bold"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
                )}
              >
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: SCOPE_COLOR[stop.key],
                    outline: `1px solid ${SCOPE_STROKE[stop.key]}`,
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-left">
                  {stop.tick}
                </span>
                {typeof count === "number" ? (
                  <span className="shrink-0 tabular-nums opacity-70">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {scope === "google" ? (
        <p
          role="note"
          className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 type-meta text-amber-900 ring-1 ring-amber-400/30"
        >
          <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Google Places are not curated by Mesita. Nobody checked them —
            quality varies, and every detail comes straight from Google.
          </span>
        </p>
      ) : null}
    </>
  );
}
