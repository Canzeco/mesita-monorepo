"use client";

// Where-module location search (MESITA-672): type any place or area → pick →
// resolve to a CENTER the distance filter rings. Autocomplete rides the shared
// EF (consumer-web-suggest-places, session-tokened, no CORS); only the chosen
// prediction is geocoded to lat/lng — client-side via zone-geocode (Google
// Places details, the GooglePlaceSheet precedent). "Current location" clears
// back to the device fix. Self-contained so BOTH hosts (Swipe + Search) get the
// same field with no extra wiring.

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { resolveZoneFromPlaceId } from "@/lib/zone-geocode";
import { setDiscoveryZone } from "@/lib/use-discovery-filters";
import type { DiscoveryZone } from "@/lib/discovery-filters-engine";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { Pill } from "./discovery-filter-controls";
import { newSessionToken } from "./search/search-utils";

const SUGGEST_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
// Public Google key the map already runs on — inlined at build (NEXT_PUBLIC_*),
// so it's available on BOTH the Search and Swipe surfaces client-side.
const GMP_KEY = process.env.NEXT_PUBLIC_GMP_KEY ?? "";

export function DiscoveryZoneField({
  zone,
  hasLocation,
}: {
  /** Active searched center, or null = current location / here. */
  zone: DiscoveryZone | null;
  /** Device geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  const supabase = useBrowserSupabase();
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const trimmed = query.trim();

  // Synchronous resets live in the change handler (the set-state-in-effect lint
  // rule bars them from the effect below); the effect only owns the debounced
  // async fetch.
  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setSearching(false);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  };

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (!cancelled) setPredictions(rows);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [supabase, trimmed]);

  const pick = async (prediction: PlacePrediction) => {
    if (resolvingId) return;
    setResolvingId(prediction.placeId);
    try {
      const resolved = await resolveZoneFromPlaceId(
        prediction.placeId,
        GMP_KEY,
        prediction.mainText,
      );
      if (!resolved) {
        toast.error("Couldn't locate that place — try another.");
        return;
      }
      setDiscoveryZone(resolved);
      // Clear the field + end the Places session (fresh token next search).
      setQuery("");
      setPredictions([]);
      sessionTokenRef.current = newSessionToken();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't locate that place — try again."));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Pill active={zone === null} onClick={() => setDiscoveryZone(null)}>
          <LocateFixed className="h-3.5 w-3.5" /> Current location
        </Pill>
        {zone && (
          <span className="bg-pink-gradient flex min-h-11 items-center gap-1.5 rounded-full py-1 pr-2 pl-4 text-[13px] font-medium text-white shadow-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[180px] truncate">{zone.label}</span>
            <button
              type="button"
              onClick={() => setDiscoveryZone(null)}
              aria-label="Clear location"
              className="flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {!hasLocation && zone === null && (
        <p className="text-muted-foreground/70 text-[11px]">
          Turn on location to rank by distance, or search a place below.
        </p>
      )}

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="Search a city, zone or address…"
          className="bg-muted/60 focus:bg-background focus:ring-primary/30 h-11 w-full rounded-full pr-9 pl-9 text-[13px] outline-none focus:ring-2"
        />
        {(searching || query.length > 0) && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2">
            {searching ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <button
                type="button"
                onClick={() => updateQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </span>
        )}
      </div>

      {trimmed.length >= MIN_QUERY_LENGTH && (
        <div className="border-border/60 divide-border/50 max-h-56 divide-y overflow-y-auto rounded-2xl border">
          {predictions.length === 0 && !searching ? (
            <p className="text-muted-foreground px-3 py-3 text-[13px]">
              No matches.
            </p>
          ) : (
            predictions.map((prediction) => (
              <button
                key={prediction.placeId}
                type="button"
                onClick={() => pick(prediction)}
                disabled={resolvingId !== null}
                className={cn(
                  "hover:bg-muted/50 flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition",
                  resolvingId !== null && "opacity-60",
                )}
              >
                <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {prediction.mainText}
                  </span>
                  {prediction.secondaryText && (
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {prediction.secondaryText}
                    </span>
                  )}
                </span>
                {resolvingId === prediction.placeId && (
                  <Spinner className="h-4 w-4 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
