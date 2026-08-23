"use client";

import Link from "next/link";
import { Compass, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Spinner } from "@/components/shared";
import { cn } from "@/lib/utils";
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

/**
 * Shown while a filtered deck is in flight and the current one has nothing
 * left to show (MESITA-1153). Without it, changing a filter flashes "Nothing
 * matches" for the length of a round trip and then fills — which reads as the
 * filter having broken and then fixed itself.
 */
export function LoadingDeck() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <Spinner size="lg" />
      <p className="text-muted-foreground text-sm">Finding matches...</p>
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
  /** Provided ONLY when a filter is active. An empty deck has two very
   *  different causes — you saw everything, or you narrowed it to nothing —
   *  and they need different offers. Absent = the honest "caught up". */
  onAdjustFilters?: () => void;
}) {
  const narrowed = onAdjustFilters != null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-2xl">
        <Compass className="text-muted-foreground h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {narrowed ? "Nothing matches" : "You're caught up"}
      </h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        {narrowed
          ? "No place fits every filter you've set. Loosen one and the deck fills back up."
          : "You've seen every place we have. Check the catalog or map, or start over from the top."}
      </p>
      {narrowed && (
        <button
          type="button"
          onClick={onAdjustFilters}
          className="bg-foreground text-background mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Adjust filters
        </button>
      )}
      <button
        type="button"
        onClick={onRestart}
        disabled={restarting}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:cursor-default disabled:opacity-70",
          // Demoted when a filter is the cause: restarting a deck the filters
          // will empty again just repeats this screen.
          narrowed
            ? "border-border bg-card text-foreground hover:bg-muted border"
            : "bg-foreground text-background mt-2 hover:opacity-90",
        )}
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
// withUserDistance moved to @/lib/place-distance when Catalog un-parked —
// both discovery surfaces measure from the same center. Re-exported here so
// the swipe route's existing import sites keep working.
export { withUserDistance } from "@/lib/place-distance";
