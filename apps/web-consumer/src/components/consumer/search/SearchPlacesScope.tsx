"use client";

import type { KeyboardEvent } from "react";
import { TriangleAlert } from "lucide-react";
import {
  MAP_SEARCH_STOPS,
  type MapSearchPower,
} from "@/lib/map-filters-engine";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_ENRICHED_PIN_COLOR,
} from "@/lib/map-defaults";
import { cn } from "@/lib/utils";

// Places scope — TWO nested sets (Pato, 2026-08-29): Mesita Places ⊂
// Google Places. Two radio pills, each wearing its pin colour as a dot
// (Mesita red, Google gray); partner pins stay yellow ON THE MAP but
// Partners is a paint, never a scope. Compact on purpose: the Filters
// sheet must show every option without scrolling.
//
// Selected is a FILL, not a hairline (Pato, 2026-08-29): two white pills
// telling each other apart by a border tint is not a selection. This is
// an exclusive choice, so it wears the same language as How many —
// `bg-foreground text-background` — while multi-select Super Category
// keeps the pink Pill. Unselected sits on `bg-muted` so the pair differs
// by fill, not only by ink. The dots survive the dark fill: #ff2357 and
// #9ca3af both read on near-black.
//
// Leaving Mesita Places WARNS (Pato, 2026-08-29). The Mesita set is
// curated — created and enriched; the Google set is whatever Google
// returned, so a guest reaching for more places is told what the extra
// ones cost in quality. The warning rides the control, not the sheet:
// whoever renders the scope renders its caveat.

const STOP_DOT: Record<(typeof MAP_SEARCH_STOPS)[number]["key"], string> = {
  places: MAP_ENRICHED_PIN_COLOR,
  google: MAP_GOOGLE_PIN_COLOR,
};

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

  const googleScope = power >= 2;

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Places"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-1.5"
      >
        {MAP_SEARCH_STOPS.map((stop) => {
          const active = power === stop.power;
          return (
            <button
              key={stop.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={stop.hint}
              tabIndex={active ? 0 : -1}
              onClick={() => onPower(stop.power)}
              className={cn(
                "flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 type-meta whitespace-nowrap transition",
                active
                  ? "border-foreground bg-foreground text-background font-bold"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground font-semibold",
              )}
            >
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STOP_DOT[stop.key] }}
              />
              {stop.tick}
            </button>
          );
        })}
      </div>
      {googleScope ? (
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
