"use client";

import Link from "next/link";
import { Compass, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Spinner } from "@/components/shared";
import { haversineKm } from "@/lib/utils";
import type { Coords } from "@/lib/use-user-location";
import type { Place } from "@/lib/api/places";

export function EmptyDeck({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="bg-foreground text-background mt-2 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function ExhaustedDeck({
  onRestart,
  restarting,
  onAdjustFilters,
}: {
  onRestart: () => void;
  restarting: boolean;
  /** Shown when discovery filters are narrowing the deck — the copy says
      "widen your filters", so give that sentence a button (MESITA-646). */
  onAdjustFilters?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        You&apos;re caught up
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        You&apos;ve seen every place in this filter. Check the catalog or map,
        widen your filters, or start over from the top.
      </p>
      <button
        type="button"
        onClick={onRestart}
        disabled={restarting}
        className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:cursor-default disabled:opacity-70"
      >
        {restarting ? (
          <>
            <Spinner size="sm" className="border-white/40 border-t-white" />
            Loading...
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" />
            Start over
          </>
        )}
      </button>
      {onAdjustFilters && (
        <button
          type="button"
          onClick={onAdjustFilters}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Adjust filters
        </button>
      )}
    </div>
  );
}

// The deck is non-empty but the discovery filters exclude every card
// (MESITA-646) — distinct from EmptyDeck ("catalog is empty") and
// ExhaustedDeck ("you swiped them all"). The escape is one tap deep.
export function FilterEmptyDeck({
  onAdjustFilters,
  onResetFilters,
}: {
  onAdjustFilters: () => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <SlidersHorizontal className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Nothing matches your filters
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        Every place in the deck is filtered out right now. Loosen a filter, or
        reset to see the full deck again.
      </p>
      <button
        type="button"
        onClick={onAdjustFilters}
        className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Adjust filters
      </button>
      <button
        type="button"
        onClick={onResetFilters}
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition"
      >
        Reset filters
      </button>
    </div>
  );
}

export function shuffleDeck(input: Place[]): Place[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Resolve a place's distance_km against the consumer's live position. A
// real geolocated distance only ever replaces — never erases — what was
// there. lat/lng ride along as PostgREST-serialized strings at runtime,
// hence the coercion. When no distance can be computed (geolocation
// pending/denied, or the place carries no coordinates) we keep any
// distance it already had, otherwise drop in a "0 km" placeholder so the
// chip still renders. Real readings floor at 0.1 km, so "0 km" is
// unambiguously the "couldn't calculate" case and never a true distance.
export function withUserDistance(place: Place, coords: Coords | null): Place {
  if (coords) {
    const lat = toCoord(place.lat);
    const lng = toCoord(place.lng);
    if (lat != null && lng != null) {
      const km = haversineKm(coords.lat, coords.lng, lat, lng);
      const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
      return { ...place, distance_km: Math.max(rounded, 0.1) };
    }
  }
  return place.distance_km != null ? place : { ...place, distance_km: 0 };
}

export function toCoord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
