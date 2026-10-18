"use client";

import { useId, type KeyboardEvent } from "react";
import { TriangleAlert } from "lucide-react";
import {
  MAP_SEARCH_STOPS,
  type MapPlacesScope,
  type PlacesScopeStop,
} from "@/lib/map-filters-engine";
import { type PinTone, pinToneColor } from "./search-pins";
import { cn } from "@/lib/utils";

// Places scope — TWO SETS (MESITA-2298), named for the guest:
//
//   Google Places  ⊃  Mesita Selected
//      gray               red
//
// A superset, so the figure is CONCENTRIC RINGS (an Euler diagram), not
// overlapping circles. The rings are the whole point of the module: nothing
// else in the product says what the pin colours mean, and the guest is
// looking at those pins right now. No enrichment word reaches the guest here.
//
// THE FIGURE IS 28px AND SITS BESIDE THE LEGEND, not above it.
// Picked is a FILL, not a hairline. EACH ROW CARRIES ITS COUNT.
// The fills are the pin tones themselves (`pinToneColor`), so the glyph,
// the row dot and the map pin cannot disagree.

const SCOPE_STROKE: Record<MapPlacesScope, string> = {
  google: "#6b7280",
  selected: "#c4123c",
};

/** The pin tone each set paints: Mesita Selected is the red of a written-up profile. */
const RING_TONE: Record<MapPlacesScope, PinTone> = {
  google: "google",
  selected: "enriched",
};

const GLYPH = 28;
const GLYPH_RADII: Record<MapPlacesScope, number> = {
  google: 12.5,
  selected: 7,
};

function widestFirst<K extends string>(
  stops: readonly PlacesScopeStop<K>[],
): PlacesScopeStop<K>[] {
  return [...stops].sort((a, b) => GLYPH_RADII[b.ring] - GLYPH_RADII[a.ring]);
}

/** The chain as one 28px figure: every ring drawn, the picked one filled. */
function ScopeGlyph<K extends string>({
  ring,
  stops,
}: {
  ring: MapPlacesScope;
  stops: readonly PlacesScopeStop<K>[];
}) {
  const mid = GLYPH / 2;
  return (
    <svg
      aria-hidden
      width={GLYPH}
      height={GLYPH}
      viewBox={`0 0 ${GLYPH} ${GLYPH}`}
      className="shrink-0"
    >
      {/* Widest first, so each inner ring paints over the one around it. */}
      {widestFirst(stops).map((stop) => {
        const inside = GLYPH_RADII[stop.ring] <= GLYPH_RADII[ring];
        return (
          <circle
            key={stop.key}
            cx={mid}
            cy={mid}
            r={GLYPH_RADII[stop.ring]}
            fill={inside ? pinToneColor(RING_TONE[stop.ring]) : "none"}
            stroke={SCOPE_STROKE[stop.ring]}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

export function SearchPlacesScope<K extends string = MapPlacesScope>({
  scope,
  onScope,
  counts,
  stops = MAP_SEARCH_STOPS as unknown as readonly PlacesScopeStop<K>[],
  label = "Places",
}: {
  scope: K;
  onScope: (scope: K) => void;
  /** Places each ring would show, from the catalog already in hand. */
  counts?: Partial<Record<K, number>>;
  /** The radios, in order. The Map's two by default. */
  stops?: readonly PlacesScopeStop<K>[];
  /** The radiogroup's accessible name — the module label it sits under. */
  label?: string;
}) {
  const chainId = useId();
  const picked = stops.find((stop) => stop.key === scope) ?? stops[0]!;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = stops.findIndex((stop) => stop.key === scope);
    const last = stops.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onScope(stops[Math.min(index + 1, last)]!.key);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onScope(stops[Math.max(index - 1, 0)]!.key);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onScope(stops[0]!.key);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onScope(stops[last]!.key);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5">
        <ScopeGlyph ring={picked.ring} stops={stops} />
        <p id={chainId} className="sr-only">
          {`Nested sets: ${widestFirst(stops)
            .map((stop) => stop.tick)
            .join(" contains ")}.`}
        </p>
        <div
          role="radiogroup"
          aria-label={label}
          aria-describedby={chainId}
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-1 flex-col gap-1"
        >
          {stops.map((stop) => {
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
                    ? "border-foreground bg-foreground text-paper font-bold"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
                )}
              >
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: pinToneColor(RING_TONE[stop.ring]),
                    // On the filled (ink) active row, a paper hairline keeps
                    // the ink dot visible.
                    outline: `1px solid ${active ? "#ffffff" : SCOPE_STROKE[stop.ring]}`,
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
      {picked.ring === "google" ? (
        <p
          role="note"
          className="mt-2 flex items-start gap-1.5 rounded-xl bg-muted px-2.5 py-2 type-body text-foreground ring-1 ring-foreground"
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
