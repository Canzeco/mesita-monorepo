"use client";

// Where-module location search (MESITA-672, unified field MESITA-905): one
// control — search + in-field locate. Selected zone = chip-in-field + clear.
// Autocomplete rides consumer-web-suggest-places; only the chosen prediction
// is geocoded. Locate clears back to the device fix (zone = null).

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
import { newSessionToken } from "./search/search-utils";

const SUGGEST_DEBOUNCE_MS = 300;
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
  const locateActive = zone === null;

  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < 2) {
      setPredictions([]);
      setSearching(false);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  };

  useEffect(() => {
    if (trimmed.length < 2) return;
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
      setQuery("");
      setPredictions([]);
      sessionTokenRef.current = newSessionToken();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't locate that place — try again."));
    } finally {
      setResolvingId(null);
    }
  };

  const clearZone = () => {
    setDiscoveryZone(null);
    setQuery("");
    setPredictions([]);
  };

  return (
    <div className="space-y-2">
      <div className="bg-muted/60 relative flex h-11 items-center rounded-full pr-1 pl-3">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        {zone ? (
          <span className="bg-pink-gradient shadow-glow-sm ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-[13px] font-medium text-white">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{zone.label}</span>
            <button
              type="button"
              onClick={clearZone}
              aria-label="Clear location"
              /* 24px visual, 44px target. The row is a fixed h-11 and the
                 chip adds py-1, so sizing this to min-h-11 like every other
                 filter control would push the chip to 52px and burst the row.
                 The ::before box is invisible, costs no layout, and is the
                 only thing a finger has to hit. */
              className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition before:absolute before:-inset-2.5 before:content-[''] hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search a city, zone or address…"
            className="placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none"
          />
        )}
        {(searching || (!zone && query.length > 0)) && (
          <span className="mr-1 shrink-0">
            {searching ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <button
                type="button"
                onClick={() => updateQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground flex h-11 w-11 items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={clearZone}
          aria-label="Use current location"
          aria-pressed={locateActive}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition",
            locateActive
              ? "bg-pink-gradient shadow-glow-sm text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>

      {!hasLocation && zone === null && (
        <p className="text-muted-foreground/70 text-[11px]">
          Turn on location to rank by distance, or search a place above.
        </p>
      )}

      {!zone && trimmed.length >= 2 && (
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
                  "hover:bg-muted/50 flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left transition",
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
