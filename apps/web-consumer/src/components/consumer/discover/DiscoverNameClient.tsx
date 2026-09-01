"use client";

// NAME — Discover's typed mode. Search Mesita place names, as a full list.
//
// WHY IT IS A SEPARATE MODE. On the map the same results render as an overlay
// panel floating over the pins, capped at max-h-[70%]. That is the right shape
// when you are looking at a map and want to jump somewhere on it. It is the
// wrong shape when you already know the name and just want the place: the map
// is doing nothing for you, and the panel is a 70%-tall lid over it.
//
// TWO THINGS THE SPLIT HAD TO CARRY, or information dies silently:
//
//   1. THE MEMBERSHIP COLOUR DOT. Yellow = Partner, red = Mesita Place, grey =
//      Google-only. On the map the PIN colour carried it, which is why
//      SearchResultsPanel deliberately ships no source labels. A list with no
//      pins keeps the dot or the distinction is simply gone. Reusing
//      SearchResultsPanel rather than rendering rows here is what guarantees
//      that — the dot lives in it.
//   2. WHERE IS IT. The overlay never had to say, because the pin was right
//      there. This mode has no map, so an on-Mesita tap goes straight to the
//      place detail instead of "selecting" something the guest cannot see.
//
// DUPLICATION, NAMED. The fast-then-deep debounce below mirrors SearchClient's.
// Extracting a shared hook would mean refactoring an 849-line live component
// that owns the map camera and the catalog join this mode does not have — and
// the map is the highest-traffic surface in the app. The orchestration here is
// genuinely simpler (no camera to follow, no catalog to match against), and the
// part worth sharing — `apiSuggestPlaces` and `SearchResultsPanel` — IS shared.
// If a third caller appears, extract then.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchBar } from "@/components/consumer/search/SearchBar";
import { SearchResultsPanel } from "@/components/consumer/search/SearchResultsPanel";
import { GooglePlaceSheet } from "@/components/consumer/search/GooglePlaceSheet";
import type { AddState } from "@/components/consumer/search/add-state";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import { useUserLocation } from "@/lib/use-user-location";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import { placeHref } from "@/lib/place-route";
import { errMsg } from "@/lib/utils";

// Same three constants the map uses. Divergence here would mean the two modes
// felt different while doing the same thing.
const FAST_DEBOUNCE_MS = 300;
const DEEP_IDLE_MS = 1000;
const MIN_QUERY = 2;

export function DiscoverNameClient({ apiKey }: { apiKey: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useMemo(() => coords ?? MONTERREY_CENTER, [coords]);

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [googlePick, setGooglePick] = useState<PlacePrediction | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);

  // One autocomplete session per typing run. Reset when the query drops below
  // the threshold, exactly as the map does — Google bills per session and a
  // token that never rotates is one unbounded session.
  const sessionRef = useRef<string>(crypto.randomUUID());
  const trimmed = query.trim();

  // Derived search state stays in the handler, not the effect: the
  // set-state-in-effect lint rule bars resetting it below, and flagging
  // `searching` on the keystroke is what stops the debounce window from
  // flashing an empty state between characters.
  function updateQuery(next: string) {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < MIN_QUERY) {
      if (trimmed.length >= MIN_QUERY) sessionRef.current = crypto.randomUUID();
      setPredictions([]);
      setSearching(false);
      setSearchError(null);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  }

  // Fast (Autocomplete) while typing; Deep replaces the list once the guest
  // stops, but only when Deep actually has rows — an empty Deep keeps Fast
  // rather than blanking a list the guest is already reading.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    let deepSettled = false;
    const token = sessionRef.current;

    const fast = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          token,
          origin,
          "fast",
        );
        if (!cancelled && !deepSettled) {
          setPredictions(rows);
          setSearchError(null);
          // Empty Fast keeps `searching` true so Deep can fill without the
          // list flashing "no matches" in between.
          if (rows.length > 0) setSearching(false);
        }
      } catch (err) {
        if (!cancelled && !deepSettled) {
          setPredictions([]);
          setSearchError(errMsg(err, "Search failed — try again."));
          setSearching(false);
        }
      }
    }, FAST_DEBOUNCE_MS);

    const deep = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          token,
          origin,
          "deep",
        );
        if (!cancelled) {
          if (rows.length > 0) {
            deepSettled = true;
            setPredictions(rows);
            setSearchError(null);
          }
          setSearching(false);
        }
      } catch {
        // Keep Fast's rows if Deep fails — a worse list beats no list.
        if (!cancelled) setSearching(false);
      }
    }, DEEP_IDLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(fast);
      window.clearTimeout(deep);
    };
  }, [supabase, trimmed, origin]);

  // No map to select on, so an on-Mesita row opens the place. This is the one
  // behavioural difference from the map's panel, and it is the point of the
  // mode: you typed a name because you already know where you want to go.
  function onPickMesita(prediction: PlacePrediction) {
    const target = prediction.mesitaSlug ?? prediction.mesitaId;
    if (target) router.push(placeHref(target));
  }

  function onPickGoogle(prediction: PlacePrediction) {
    setGooglePick(prediction);
    setGoogleOpen(true);
  }

  // Adding a Google-only place to Mesita is the map's job — it owns the
  // create-project call and the optimistic pin. Here the sheet is read-only:
  // see it, then go to the map to add it.
  const addStates: Record<string, AddState> = {};

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border bg-background/90 shrink-0 border-b px-3 py-2.5 backdrop-blur-xl">
        <SearchBar
          query={query}
          showClear={query.length > 0}
          onQueryChange={updateQuery}
          onClear={() => updateQuery("")}
          placeholder="Search places by name…"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SearchResultsPanel
          query={query}
          searching={searching}
          searchError={searchError}
          predictions={predictions}
          addStates={addStates}
          onPickMesita={onPickMesita}
          onPickGoogle={onPickGoogle}
        />
      </div>

      <GooglePlaceSheet
        open={googleOpen}
        prediction={googlePick}
        addState={undefined}
        apiKey={apiKey}
        onAdd={onPickGoogle}
        onClose={() => setGoogleOpen(false)}
      />
    </div>
  );
}
