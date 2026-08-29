"use client";

// Search — the consumer catalog map. Composition layer for the page:
//
//   • Base: SearchMap fills the body (yellow Partners, red Mesita Places,
//     gray Google, blue user).
//   • Top overlay: query pill + Filters button. Places scope + Super
//     Category + How many (20 / 40 / 60) live in the map Filters
//     sheet — there is no Category chip strip on the map. Default is
//     + Places. Distance and time are not map knobs. Swipe keeps Discovery.
//   • Bottom overlay (idle): catalog rail around the camera. Places
//     scope picks the engine (Partners / + enriched Places / + Google
//     Nearby). Super Category cuts Mesita only. The rail is closest
//     first. A guest pan auto-reloads after reloadMinKm AND reloadMinSec.
//     Only a finger-drag on the map counts as travel. Rail or pin
//     selection pans rebase the km origin so click-by-click catalog
//     browsing cannot add up. A user pan also dismisses the name
//     overlay (query text stays; tap the bar to open it again). The
//     rail's center card is always the selected pin. Scroll picks the
//     center; a pin tap scrolls that card to center. Tapping the
//     already-selected card opens the place (Google-only stubs open
//     GooglePlaceSheet).
//   • Typing ≥2 chars runs Fast Search (Autocomplete, ~300ms). One second
//     after the guest stops, Deep Search replaces that list when it has
//     rows (Partners · Mesita · Google). Empty Deep keeps Fast. One Google
//     session token per autocomplete session.
//     Results hang at content height. No source labels — the colored point
//     is membership (yellow Partner / red Mesita Place / gray Google).
//     On-Mesita rows select the place on the map; Google-only rows open
//     GooglePlaceSheet.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import { apiFetchNearbyCatalog, CATALOG_NEARBY_MAX } from "@/lib/api/places";
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
import { useSearchScope } from "@/lib/use-search-scope";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import {
  buildSearchMapPins,
  catalogPlaceOnMesita,
  overlayPinDecision,
  predictionOnMesita,
} from "@/lib/search-membership";
import { SearchMap, type SearchMapPin, type ViewportBox } from "./SearchMap";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { GooglePlaceSheet } from "./GooglePlaceSheet";
import {
  applyMapFilters,
  mapFilterCount,
  mapFiltersAreActive,
  takeMapResultLimit,
} from "@/lib/map-filters-engine";
import { resetMapFilters, useMapFilters } from "@/lib/use-map-filters";
import { SearchBar } from "./SearchBar";
import { SearchFilterRow } from "./SearchFilterRow";
import { SearchMapFilters } from "./SearchMapFilters";
import type { AddState } from "./add-state";
import {
  EmptySearchPrompt,
  SearchRailOverlay,
} from "./search-catalog-overlays";
import {
  CATALOG_RELOAD_MIN_KM,
  CATALOG_RELOAD_MIN_SEC,
  catalogIsStale,
  catalogMovedEnough,
  clampReloadMinKm,
  clampReloadMinSec,
  defaultRailSelection,
  matchPredictionToPlace,
  newSessionToken,
  railCenterIndex,
  shouldReloadNearbyCatalog,
  viewportCenter,
  withDistances,
} from "./search-utils";

// Fast Search while typing; Deep Search after the guest stops.
const FAST_DEBOUNCE_MS = 300;
const DEEP_IDLE_MS = 1000;
const MIN_SUGGEST_QUERY_LENGTH = 2;

function googlePredictionFromPlace(place: Place): PlacePrediction | null {
  if (!place.googleOnly && !place.from_google) return null;
  if (catalogPlaceOnMesita(place)) return null;
  const placeId =
    place.google_place_id ||
    place.slug ||
    (place.id.startsWith("g:") ? place.id.slice(2) : "");
  if (!placeId) return null;
  return {
    placeId,
    mainText: place.name,
    secondaryText: place.address ?? "",
    status: "not_in_mesita",
    partner: false,
    lat: place.lat,
    lng: place.lng,
  };
}

export function SearchClient({ apiKey }: { apiKey: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  const [places, setPlaces] = useState<Place[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(() => Boolean(apiKey));
  const [cameraCenter, setCameraCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const viewportGen = useRef(0);
  // Google Places session token. Per Google's session-billing semantics a
  // session spans the keystrokes up to ONE selection — so the token is
  // regenerated after every selection (Info / Add tap) and whenever the
  // results panel is dismissed, scoping each autocomplete run properly.
  const sessionTokenRef = useRef(newSessionToken());
  const railRefs = useRef(new Map<string, HTMLElement | null>());
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  // Opened by tapping the search field — the results/suggest panel appears on
  // one tap, before any typing.
  const [searchOpen, setSearchOpen] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  /** Google placeId → Mesita slug/id after Add to Mesita succeeds. */
  const [addedProfiles, setAddedProfiles] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Overlay pin first-tap stash so a later tap can still open (profile or
  // Google sheet) after the suggest list is gone. Holds Google and overlay-only
  // Mesita predictions — keyed on pin.id.
  const [heldOverlay, setHeldOverlay] = useState<PlacePrediction | null>(null);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useMapFilters();
  const scope = useSearchScope();
  const location = scope.locationOptOut ? null : userLocation;
  const center = location;

  const trimmed = query.trim();
  // Idle = map-browse. The name overlay is a query mode, not a viewport.
  // Closing it (map drag, map tap, X) returns the rail even if leftover
  // query text sits in the bar.
  const idle = !searchOpen;

  // Distances follow the camera the catalog was fetched for, so a pan
  // ranks and labels the same nearby set. GPS still recenters the map.
  const distanceCenter = cameraCenter ?? location;
  const nearby = useMemo(
    () => withDistances(places.map(enrichPlaceOverview), distanceCenter),
    [places, distanceCenter],
  );
  // Closest first by distance_km, then How many keeps 20 / 40 / 60.
  const catalog = useMemo(() => {
    const cut = applyMapFilters(nearby, filters);
    return takeMapResultLimit(cut, filters.resultLimit);
  }, [nearby, filters]);
  const filtersCutCatalog =
    nearby.length > 0 && catalog.length === 0 && mapFiltersAreActive(filters);

  const searchPins = useMemo(
    () => buildSearchMapPins(predictions, catalog),
    [predictions, catalog],
  );

  const idleRef = useRef(idle);
  const lastBoxRef = useRef<ViewportBox | null>(null);
  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastFetchedAtMs = useRef<number | null>(null);
  const reloadMinKmRef = useRef(CATALOG_RELOAD_MIN_KM);
  const reloadMinSecRef = useRef(CATALOG_RELOAD_MIN_SEC);
  const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceNextLoad = useRef(false);
  const seenLocationKey = useRef<string | null>(null);

  const clearPendingReload = useCallback(() => {
    if (pendingReload.current == null) return;
    clearTimeout(pendingReload.current);
    pendingReload.current = null;
  }, []);

  const markViewport = useCallback((box: ViewportBox) => {
    lastBoxRef.current = box;
  }, []);

  const loadViewport = useCallback(
    async (box: ViewportBox) => {
      lastBoxRef.current = box;
      if (!idleRef.current) {
        markViewport(box);
        return;
      }
      const nextCenter = viewportCenter(box);
      const gen = ++viewportGen.current;
      setCatalogLoading(true);
      setFetchError(null);
      try {
        const result = await apiFetchNearbyCatalog(
          supabase,
          nextCenter,
          CATALOG_NEARBY_MAX,
          filters.searchPower,
          filters.familyKeys,
        );
        if (gen !== viewportGen.current) return;
        lastFetchedCenter.current = nextCenter;
        lastFetchedAtMs.current = Date.now();
        reloadMinKmRef.current = clampReloadMinKm(result.reloadMinKm);
        reloadMinSecRef.current = clampReloadMinSec(result.reloadMinSec);
        setCameraCenter(nextCenter);
        setPlaces(result.places);
      } catch (err) {
        if (gen !== viewportGen.current) return;
        setFetchError(errMsg(err, "Couldn't load places in this area."));
      } finally {
        if (gen === viewportGen.current) setCatalogLoading(false);
      }
    },
    [filters.searchPower, filters.familyKeys, markViewport, supabase],
  );

  const scheduleOrLoad = useCallback(
    (box: ViewportBox) => {
      const next = viewportCenter(box);
      const now = Date.now();
      const minKm = reloadMinKmRef.current;
      const minSec = reloadMinSecRef.current;
      if (
        shouldReloadNearbyCatalog(lastFetchedCenter.current, next, box, minKm, {
          fetchedAtMs: lastFetchedAtMs.current,
          nowMs: now,
          minSec,
        })
      ) {
        clearPendingReload();
        void loadViewport(box);
        return;
      }
      if (
        catalogMovedEnough(lastFetchedCenter.current, next, box, minKm) &&
        lastFetchedAtMs.current != null
      ) {
        const wait =
          clampReloadMinSec(minSec) * 1000 - (now - lastFetchedAtMs.current);
        clearPendingReload();
        if (wait > 0) {
          pendingReload.current = setTimeout(() => {
            pendingReload.current = null;
            if (!idleRef.current || !lastBoxRef.current) return;
            void loadViewport(lastBoxRef.current);
          }, wait);
        }
      } else {
        clearPendingReload();
      }
    },
    [clearPendingReload, loadViewport],
  );

  const onFirstViewport = useCallback(
    (box: ViewportBox) => {
      void loadViewport(box);
    },
    [loadViewport],
  );

  const closeNameOverlay = useCallback(() => {
    setSearchOpen(false);
    idleRef.current = true;
    searchInputRef.current?.blur();
  }, []);

  const onUserViewport = useCallback(
    (box: ViewportBox, meta: { programmatic: boolean }) => {
      markViewport(box);
      if (meta.programmatic) {
        // Rail / pin / GPS pans move the camera but do not travel.
        // Rebase the km origin so click-by-click catalog browsing
        // cannot accumulate toward reload. Time still starts from
        // the last real fetch.
        lastFetchedCenter.current = viewportCenter(box);
        clearPendingReload();
        if (forceNextLoad.current) {
          forceNextLoad.current = false;
          void loadViewport(box);
        }
        return;
      }
      // Finger on the map = I want the map. Name results are a query
      // overlay, not a viewport. Keep the typed text so a bar tap
      // opens the same list again. Do not re-run name search.
      closeNameOverlay();
      if (forceNextLoad.current) {
        forceNextLoad.current = false;
        clearPendingReload();
        void loadViewport(box);
        return;
      }
      scheduleOrLoad(box);
    },
    [
      clearPendingReload,
      closeNameOverlay,
      loadViewport,
      markViewport,
      scheduleOrLoad,
    ],
  );

  useEffect(() => () => clearPendingReload(), [clearPendingReload]);

  useEffect(() => {
    idleRef.current = idle;
  }, [idle]);

  // Places scope and Super Category both change the Nearby engine.
  // Super pills pick Google includedPrimaryTypes. The query bar
  // (Fast / Deep Autocomplete) never reads these filters.
  useEffect(() => {
    if (!lastFetchedCenter.current || !lastBoxRef.current) return;
    clearPendingReload();
    void loadViewport(lastBoxRef.current);
  }, [clearPendingReload, filters.searchPower, loadViewport]);

  const locationKey = location ? `${location.lat},${location.lng}` : null;

  useEffect(() => {
    if (!locationKey) {
      seenLocationKey.current = null;
      return;
    }
    if (seenLocationKey.current === locationKey) return;

    const [latRaw, lngRaw] = locationKey.split(",");
    const next = { lat: Number(latRaw), lng: Number(lngRaw) };
    const firstFix = seenLocationKey.current == null;
    seenLocationKey.current = locationKey;

    // First GPS at mount: the first tile idle fetches that camera. A
    // later fix, or a first fix after the default-city tile already
    // loaded, reloads once when Recentre settles.
    if (!firstFix || catalogIsStale(lastFetchedCenter.current, next)) {
      forceNextLoad.current = true;
    }
  }, [locationKey]);

  // End the current Places autocomplete session and mint the next one.
  const resetSearchSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

  const openMesitaProfileFromPrediction = useCallback(
    (prediction: PlacePrediction) => {
      resetSearchSession();
      setQuery("");
      setSearchOpen(false);
      const fromAdd = addedProfiles[prediction.placeId];
      if (fromAdd) {
        router.push(placeHref(fromAdd));
        return;
      }
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(placeHref(direct));
        return;
      }
      const match = matchPredictionToPlace(prediction, catalog);
      if (match) {
        router.push(placeHref(match.slug || match.id));
        return;
      }
      toast(
        "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
      );
    },
    [addedProfiles, catalog, resetSearchSession, router],
  );

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

  // Fast Search (Autocomplete) while typing. Deep Search replaces the list
  // after idle when it has rows. Empty Deep keeps Fast. A later Fast for
  // this query never overwrites a Deep hit.
  useEffect(() => {
    if (trimmed.length < MIN_SUGGEST_QUERY_LENGTH) return;
    let cancelled = false;
    let deepSettled = false;
    const token = sessionTokenRef.current;

    const fastHandle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          token,
          center,
          "fast",
        );
        if (!cancelled && !deepSettled) {
          setPredictions(rows);
          setSearchError(null);
          // Empty Fast: keep searching so Deep can fill without flashing
          // "No matches found".
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

    const deepHandle = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          token,
          center,
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
        // Keep Fast results if Deep fails.
        if (!cancelled) setSearching(false);
      }
    }, DEEP_IDLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(fastHandle);
      window.clearTimeout(deepHandle);
    };
  }, [supabase, trimmed, center]);

  // On-Mesita row tap → show the place on the map (membership fill + black
  // ring + rail card) instead of opening the detail modal; the modal is
  // one more tap away on the pin or the card. The EF-provided Mesita id is the
  // primary join; the exact-name match covers older suggest payloads.
  const handlePickMesita = (prediction: PlacePrediction) => {
    if (prediction.mesitaSlug ?? prediction.mesitaId) {
      openMesitaProfileFromPrediction(prediction);
      return;
    }
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
    const fromAdd = addedProfiles[prediction.placeId];
    if (fromAdd) {
      resetSearchSession();
      router.push(placeHref(fromAdd));
      return;
    }
    if (addStates[prediction.placeId] === "added") {
      const match =
        catalog.find((p) => p.google_place_id === prediction.placeId) ??
        matchPredictionToPlace(prediction, catalog);
      if (match) {
        resetSearchSession();
        router.push(placeHref(match.slug || match.id));
        return;
      }
    }
    if (predictionOnMesita(prediction)) {
      openMesitaProfileFromPrediction(prediction);
      return;
    }
    resetSearchSession();
    setPreview(prediction);
    setPreviewOpen(true);
  };

  const handleOpenPlace = (place: Place) => {
    const google = googlePredictionFromPlace(place);
    if (google) {
      handlePickGoogle(google);
      return;
    }
    router.push(placeHref(place.slug || place.id));
  };

  // Center page is selected even before a tap or flick writes state —
  // first load and a catalog that dropped the old id both light card 0.
  const railSelectedId = defaultRailSelection(
    catalog.map((p) => p.id),
    selectedId,
  );

  const handleSelectPin = (pin: SearchMapPin) => {
    const prediction =
      predictions.find((p) => p.mesitaId === pin.id || p.placeId === pin.id) ??
      (heldOverlay &&
      (heldOverlay.placeId === pin.id || heldOverlay.mesitaId === pin.id)
        ? heldOverlay
        : null);
    const place = catalog.find((p) => p.id === pin.id);
    const action = overlayPinDecision({
      selectedId: railSelectedId,
      pinId: pin.id,
      googleOnly: prediction ? !predictionOnMesita(prediction) : false,
      inCatalog: Boolean(place),
      hasOverlay: Boolean(prediction),
    });
    switch (action) {
      case "open-google":
        if (prediction) handlePickGoogle(prediction);
        return;
      case "open-catalog":
        if (place) handleOpenPlace(place);
        return;
      case "open-mesita-slug":
        if (prediction) handlePickMesita(prediction);
        return;
      case "select-google":
      case "select-mesita-overlay":
        if (prediction) setHeldOverlay(prediction);
        setRailCollapsed(false);
        setSelectedId(pin.id);
        return;
      case "select-mesita-catalog":
        setHeldOverlay(null);
        if (prediction) {
          handlePickMesita(prediction);
          return;
        }
        if (place) {
          setHeldOverlay(googlePredictionFromPlace(place));
          setRailCollapsed(false);
          setSelectedId(place.id);
        }
        return;
      case "noop":
        return;
    }
  };

  // Create only — the ugly profile is live immediately. Intaker waits
  // for votes on the Enrich tab. Open that profile the moment it exists.
  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      resetSearchSession();
      setAddStates((s) => ({ ...s, [prediction.placeId]: "adding" }));
      void (async () => {
        try {
          const created = await apiCreateProject(supabase, {
            placeId: prediction.placeId,
          });
          const dest = created.place.slug || created.place.id;
          setAddStates((s) => ({ ...s, [prediction.placeId]: "added" }));
          if (dest) {
            setAddedProfiles((s) => ({
              ...s,
              [prediction.placeId]: dest,
            }));
          }
          setPreviewOpen(false);
          toast.success(
            `${prediction.mainText} is on Mesita. Vote to enrich its profile.`,
          );
          if (dest) router.push(placeHref(dest));
        } catch (err) {
          setAddStates((s) => {
            const next = { ...s };
            delete next[prediction.placeId];
            return next;
          });
          toast.error(errMsg(err, "Couldn't add that place right now."));
        }
      })();
    },
    [addStates, resetSearchSession, router, supabase],
  );

  const handleRailScroll = () => {
    const el = railScrollRef.current;
    if (!el || catalog.length === 0) return;
    const page = el.clientWidth * 0.8;
    if (page <= 0) return;
    const next = railCenterIndex(el.scrollLeft, page, catalog.length);
    setRailIndex(next);
    const id = catalog[next]?.id;
    if (id) setSelectedId(id);
  };

  // Pin tap → highlight + scroll the rail to the matching card. Tapping a
  // pin also reopens the rail if it was dismissed. The map pans itself via
  // SearchMap's selectedId.
  const handleSelectPlace = (place: Place) => {
    setHeldOverlay(googlePredictionFromPlace(place));
    setRailCollapsed(false);
    setSelectedId(place.id);
  };

  // Center the rail card for the selected place once the rail is on screen.
  // Skip when the pager already names that card — scroll itself selected
  // it, and scrollIntoView would fight the flick. Pin taps still land here
  // because they change selectedId while railIndex is stale.
  useEffect(() => {
    if (!idle || railCollapsed || !railSelectedId) return;
    const idx = catalog.findIndex((p) => p.id === railSelectedId);
    if (idx < 0 || idx === railIndex) return;
    railRefs.current.get(railSelectedId)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [idle, railCollapsed, railSelectedId, catalog, railIndex]);

  const dismissSearch = () => {
    updateQuery("");
    closeNameOverlay();
  };

  const openSearch = () => {
    setSearchOpen(true);
    idleRef.current = false;
    // Focus after the panel mounts so the keyboard comes up on tap-to-open
    // (map tap or bar tap) without covering the map in a 70% sheet.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleMapClick = () => {
    // Bare map tap toggles the name overlay. Query text stays so a later
    // bar tap can reopen the same list. Pan/drag uses closeNameOverlay
    // from onUserViewport instead — Maps does not fire click on a drag.
    if (searchOpen) {
      closeNameOverlay();
      return;
    }
    openSearch();
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Base layer — pins are the nearby catalog after Places scope + Super Category. */}
      <SearchMap
        apiKey={apiKey}
        places={catalog}
        userLocation={userLocation}
        viewCenter={center}
        selectedId={railSelectedId}
        pins={searchPins}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        onSelectPin={handleSelectPin}
        onMapClick={handleMapClick}
        onFirstViewport={onFirstViewport}
        onUserViewport={onUserViewport}
      />

      {/* Floating top overlay — query pill + Filters button. Super
          Category is in the sheet, not a chrome shortcut. max-h-[70%]
          caps long lists so they scroll and the map stays visible
          below. Ask AI lives on Home › Chat. */}
      <div className="absolute inset-x-3 top-3 z-30 flex max-h-[70%] flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              query={query}
              showClear={Boolean(query || searchOpen)}
              onQueryChange={updateQuery}
              onFocus={openSearch}
              onClear={dismissSearch}
              inputRef={searchInputRef}
            />
          </div>
          {idle && (
            <SearchFilterRow
              count={mapFilterCount(filters)}
              onOpenFilters={() => setFiltersOpen(true)}
            />
          )}
        </div>

        {fetchError && idle && (
          <p className={cn(ERROR_BOX_CLASS, "rounded-xl backdrop-blur")}>
            {fetchError}
          </p>
        )}

        {searchOpen && (
          <div className="bg-card/95 border-border shadow-elev flex min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-xl">
            {trimmed.length > 0 ? (
              <SearchResultsPanel
                query={query}
                searching={searching}
                searchError={searchError}
                predictions={predictions}
                addStates={addStates}
                onPickMesita={handlePickMesita}
                onPickGoogle={handlePickGoogle}
              />
            ) : (
              <EmptySearchPrompt />
            )}
          </div>
        )}
      </div>

      <SearchRailOverlay
        idle={idle}
        places={catalog}
        catalogCount={nearby.length}
        catalogLoading={catalogLoading}
        railCollapsed={railCollapsed}
        railIndex={railIndex}
        selectedId={railSelectedId}
        railScrollRef={railScrollRef}
        onShowRail={() => setRailCollapsed(false)}
        onHideRail={() => setRailCollapsed(true)}
        onRailScroll={handleRailScroll}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        onResetFilters={filtersCutCatalog ? resetMapFilters : undefined}
        setRailCardRef={(placeId, el) => {
          railRefs.current.set(placeId, el);
        }}
      />

      <LocalSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        ariaLabel="Filters"
      >
        <SearchMapFilters
          onClose={() => setFiltersOpen(false)}
          count={catalog.length}
        />
      </LocalSheet>

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
