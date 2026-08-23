"use client";

// Search — the consumer catalog map. Composition layer for the page:
//
//   • Base: SearchMap fills the body (partner/web pins + user dot).
//   • Top overlay: full-width search bar. Nothing narrows the catalog — the
//     filter surface went with MESITA-1183, so the rail and the map pins both
//     render it whole. (Ask AI / Memo now lives as a tab on Home.)
//   • Bottom overlay (idle): horizontal catalog rail; tapping a map pin
//     highlights + scrolls to the matching rail card, tapping a card opens
//     the place page.
//   • Typing ≥2 chars runs consumer-suggest-places (debounced, one Google
//     session token per autocomplete session) and swaps in SearchResultsPanel:
//     plain one-line text rows. "On Mesita" rows select the place on the map
//     (red pin + rail card; the detail modal is one more tap away there),
//     "From Google" rows open GooglePlaceSheet — a not-on-Mesita preview
//     carrying the real Add flow (consumer-web-create-place creates the
//     place immediately; the async Enricher builds the profile in minutes).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { useUserLocation } from "@/lib/use-user-location";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { SearchMap } from "./SearchMap";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { GooglePlaceSheet } from "./GooglePlaceSheet";
import { SearchBar } from "./SearchBar";
import type { AddState } from "./add-state";
import {
  EmptySearchPrompt,
  SearchRailOverlay,
} from "./search-catalog-overlays";
import {
  matchPredictionToPlace,
  newSessionToken,
  withDistances,
} from "./search-utils";

// ≥300ms so a fast typist costs one Google autocomplete call per pause,
// not one per keystroke.
const SUGGEST_DEBOUNCE_MS = 300;
// Below this, the query is too short to suggest against — the results panel
// stays closed and no autocomplete call goes out.
const MIN_SUGGEST_QUERY_LENGTH = 2;

export function SearchClient({
  apiKey,
  places,
  fetchError,
}: {
  apiKey: string;
  places: Place[];
  fetchError: string | null;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  // Google Places session token. Per Google's session-billing semantics a
  // session spans the keystrokes up to ONE selection — so the token is
  // regenerated after every selection (Info / Add tap) and whenever the
  // results panel is dismissed, scoping each autocomplete run properly.
  const sessionTokenRef = useRef(newSessionToken());
  const railRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const railScrollRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  // Opened by tapping the search field — the results/suggest panel appears on
  // one tap, before any typing.
  const [searchOpen, setSearchOpen] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // From-Google preview sheet. `preview` survives the close (only `open`
  // flips) so the exit transition doesn't blank the panel mid-slide.
  const [preview, setPreview] = useState<PlacePrediction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // 0-based position of the card nearest the rail's scroll start (shown
  // 1-based) — powers the "3 / 12 places" pager so the horizontal rail
  // reads as browsable.
  const [railIndex, setRailIndex] = useState(0);
  // The bottom rail can be dismissed (X on the counter) to clear the map;
  // it reopens via the floating reopen pill or by tapping any pin.
  const [railCollapsed, setRailCollapsed] = useState(false);

  const trimmed = query.trim();
  // Idle = the map moment: no text query, search panel closed. The chip row
  // and catalog rail only exist here; the results panel owns the other state.
  const idle = trimmed.length === 0 && !searchOpen;

  // Distances ride on the consumer's live location. Nothing narrows the
  // catalog any more (MESITA-1183) — pins and rail render it whole.
  const catalog = useMemo(
    () => withDistances(places, userLocation),
    [places, userLocation],
  );
  const visible = catalog;

  // End the current Places autocomplete session and mint the next one.
  const resetSearchSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

  // Every query write goes through here so the derived search state stays
  // in the event handler (the set-state-in-effect lint rule bars resetting
  // it inside the effect below): short queries clear the panel, longer
  // ones flag `searching` immediately so the debounce window never
  // flashes the empty state.
  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < MIN_SUGGEST_QUERY_LENGTH) {
      // Dropping below the threshold dismisses the results panel — the
      // running autocomplete session is abandoned, so end it here and
      // start the next search on a fresh token.
      if (trimmed.length >= MIN_SUGGEST_QUERY_LENGTH) resetSearchSession();
      setPredictions([]);
      setSearching(false);
      setSearchError(null);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  };

  // Debounced live suggest — Mesita + Google merged by the EF.
  useEffect(() => {
    if (trimmed.length < MIN_SUGGEST_QUERY_LENGTH) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (!cancelled) {
          setPredictions(rows);
          setSearchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPredictions([]);
          setSearchError(errMsg(err, "Search failed — try again."));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [supabase, trimmed]);

  // On-Mesita row tap → show the place on the map (red selected pin + rail
  // card) instead of opening the detail modal; the modal is one more tap
  // away on the pin or the card. The EF-provided Mesita id is the primary
  // join; the exact-name match covers older suggest payloads.
  const handlePickMesita = (prediction: PlacePrediction) => {
    const match =
      (prediction.mesitaId
        ? catalog.find((p) => p.id === prediction.mesitaId)
        : null) ?? matchPredictionToPlace(prediction, catalog);
    if (match) {
      // Clearing the query is the selection that ends the Places session
      // (updateQuery mints the next token) and hands back the idle map.
      updateQuery("");
      setSearchOpen(false);
      setRailCollapsed(false);
      setSelectedId(match.id);
      return;
    }
    // On Mesita per the EF but outside the mappable catalog snapshot — no
    // coordinates to pin, so fall back to opening the detail modal directly.
    resetSearchSession();
    const direct = prediction.mesitaSlug ?? prediction.mesitaId;
    if (direct) {
      router.push(placeHref(direct));
      return;
    }
    toast(
      "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
    );
  };

  // From-Google row tap → the not-on-Mesita preview sheet (the Add flow
  // lives there now). Tapping a row is the selection that ends the current
  // Places autocomplete session.
  const handlePickGoogle = (prediction: PlacePrediction) => {
    resetSearchSession();
    setPreview(prediction);
    setPreviewOpen(true);
  };

  // The REAL Add flow: the place is created immediately; only enrichment is
  // scheduled (the cron-driven Enricher pipeline finishes asynchronously),
  // so hold the row in its "added / Enriching" state — nothing further to
  // await client-side.
  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      // Add is also a selection — close out the autocomplete session.
      resetSearchSession();
      setAddStates((s) => ({ ...s, [prediction.placeId]: "adding" }));
      void (async () => {
        try {
          await apiCreateProject(supabase, {
            placeId: prediction.placeId,
          });
          setAddStates((s) => ({ ...s, [prediction.placeId]: "added" }));
          toast.success(
            `${prediction.mainText} is on Mesita — our AI generates its profile in about 5 minutes.`,
          );
        } catch (err) {
          // Roll back so the button is tappable again.
          setAddStates((s) => {
            const next = { ...s };
            delete next[prediction.placeId];
            return next;
          });
          toast.error(errMsg(err, "Couldn't add that place right now."));
        }
      })();
    },
    [addStates, resetSearchSession, supabase],
  );

  // Card width (288, SearchRailCard's w-[288px]) + flex gap (8, gap-2) → the
  // horizontal stride between cards.
  const RAIL_STRIDE = 296;
  const handleRailScroll = () => {
    const el = railScrollRef.current;
    if (!el || visible.length === 0) return;
    // At the far-right end the last card is fully visible but scrollLeft never
    // reaches (n-1)·stride, so Math.round caps one short (shows n-1/n). Snap to
    // the last index once the container is scrolled to its end.
    const overflowing = el.scrollWidth > el.clientWidth;
    const atEnd =
      overflowing && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const idx = atEnd
      ? visible.length - 1
      : Math.round(el.scrollLeft / RAIL_STRIDE);
    setRailIndex(Math.max(0, Math.min(idx, visible.length - 1)));
  };

  // Pin tap → highlight + scroll the rail to the matching card. Tapping a
  // pin also reopens the rail if it was dismissed. The map pans itself via
  // SearchMap's selectedId.
  const handleSelectPlace = (place: Place) => {
    setRailCollapsed(false);
    setSelectedId(place.id);
  };

  // Center the rail card for the selected place once the rail is on screen.
  // An effect (not the tap handlers) because a search pick mounts the rail
  // on the SAME commit that sets the selection — the card ref only exists
  // after that render; it also re-centers when a dismissed rail reopens.
  useEffect(() => {
    if (!idle || railCollapsed || !selectedId) return;
    railRefs.current.get(selectedId)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [idle, railCollapsed, selectedId]);

  const dismissSearch = () => {
    updateQuery("");
    setSearchOpen(false);
  };

  const handleMapClick = () => {
    // Bare map tap toggles search: open when idle, close when the panel
    // (empty prompt or live results) is covering the top of the canvas.
    if (searchOpen || trimmed.length > 0) {
      dismissSearch();
      return;
    }
    setSearchOpen(true);
  };

  const handleOpenPlace = (place: Place) =>
    router.push(placeHref(place.slug || place.id));

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Base layer — pins reflect the same chip filtering as the rail. */}
      <SearchMap
        apiKey={apiKey}
        places={visible}
        userLocation={userLocation}
        selectedId={selectedId}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        onMapClick={handleMapClick}
      />

      {/* Floating top overlay — full-width search bar + idle chip row.
          (Ask AI moved to the Home tab's Memo concierge.) */}
      <div className="absolute inset-x-3 top-3 z-30">
        <SearchBar
          query={query}
          showClear={Boolean(query || searchOpen)}
          onQueryChange={updateQuery}
          onFocus={() => setSearchOpen(true)}
          onClear={dismissSearch}
        />

        {fetchError && idle && (
          <p className={cn(ERROR_BOX_CLASS, "mt-2 rounded-xl backdrop-blur")}>
            {fetchError}
          </p>
        )}
      </div>

      <SearchRailOverlay
        idle={idle}
        places={visible}
        catalogCount={catalog.length}
        railCollapsed={railCollapsed}
        railIndex={railIndex}
        selectedId={selectedId}
        railScrollRef={railScrollRef}
        onShowRail={() => setRailCollapsed(false)}
        onHideRail={() => setRailCollapsed(true)}
        onRailScroll={handleRailScroll}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        setRailCardRef={(placeId, el) => {
          railRefs.current.set(placeId, el);
        }}
      />

      {/* Typing swaps in live results under the floating bar. Height fits the
          result count (grows/shrinks with rows); max-h-[70%] caps long lists so
          they scroll and the map stays visible below. Sits at z-20 below the
          z-30 floating bar; pt-[60px] drops results below it. Dismiss via the
          bar's X or a tap on the visible map strip. */}
      {trimmed.length > 0 && (
        <div className="bg-background border-border shadow-rest absolute inset-x-0 top-0 z-20 flex max-h-[70%] flex-col rounded-b-3xl border-b pt-[60px]">
          <SearchResultsPanel
            query={query}
            searching={searching}
            searchError={searchError}
            predictions={predictions}
            addStates={addStates}
            onPickMesita={handlePickMesita}
            onPickGoogle={handlePickGoogle}
          />
        </div>
      )}

      {searchOpen && trimmed.length === 0 && <EmptySearchPrompt />}

      <GooglePlaceSheet
        open={previewOpen}
        prediction={preview}
        addState={preview ? addStates[preview.placeId] : undefined}
        apiKey={apiKey}
        onAdd={handleAdd}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
