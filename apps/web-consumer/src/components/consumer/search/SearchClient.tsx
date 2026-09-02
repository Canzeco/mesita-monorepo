"use client";

// SEARCH — Discover's default mode: the consumer catalog map, and the one
// surface in the app that carries a search bar.
//
// THE BAR BELONGS ON THE PINS. A search bar is a control, and a found place
// needs somewhere to land — on a bare list it lands nowhere. This is also the
// mode every session opens on, so a map with no way to type a name was asking
// the most common intent to go find another screen first.
//
// WHAT THE 2026-09-01 REMOVAL WAS ACTUALLY RIGHT ABOUT, and what it over-cut:
// the old results panel claimed a fixed 70% of the viewport whether it held
// two rows or ten, so it covered the map you typed to search. That was the
// FIXED HEIGHT, not the top anchor. Results drop from under the bar again —
// the convention, and how the standalone Search page stacked them — but they
// size to content under a cap, so three rows take a third of the screen.
//
// THERE IS NO "QUERY MODE". The map never stops being the map: the catalog
// keeps loading, the camera keeps its own rules, and typing only adds a pin
// layer and swaps the bottom rail out. A viewport load is always just a load.
//
// The from-Google preview sheet and the Add flow are NOT search chrome. The
// catalog itself carries Google-only places (the grey pins), so a pin or
// rail-card tap reaches them through handleOpenPlace, and `heldOverlay` still
// stashes a prediction between the select tap and the open.
//
// Composition:
//   • Base: SearchMap fills the body (yellow Partners, red Mesita Places,
//     gray Google, blue user). Catalog pins by default; `searchPins` overlays
//     the predictions while a query is live.
//   • Top overlay: the search bar and Filters on ONE row, then the results
//     dropdown directly beneath them. Places scope + Super Category + How many
//     (20 / 40 / 60) live in the Filters sheet, never as chips on the map.
//   • Bottom overlay: the catalog rail around the camera, hidden while
//     querying. Places scope picks the engine (Partners / + enriched Places /
//     + Google Nearby). Closest first. A guest pan auto-reloads after
//     reloadMinKm AND reloadMinSec.
//     Only a finger-drag on the map counts as travel — rail or pin selection
//     rebases the km origin so click-by-click browsing cannot add up. The
//     rail's centre card is always the selected pin.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import { apiFetchNearbyCatalog } from "@/lib/api/places";
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from "@/lib/api/place-search";
import { useUserLocation } from "@/lib/use-user-location";
import { MONTERREY_CENTER } from "@/lib/map-defaults";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { useSearchScope } from "@/lib/use-search-scope";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import {
  buildSearchMapPins,
  catalogPlaceOnMesita,
  overlayPinDecision,
  predictionOnMesita,
} from "@/lib/search-membership";
import { SearchMap, type SearchMapPin, type ViewportBox } from "./SearchMap";
import { GooglePlaceSheet } from "./GooglePlaceSheet";
import { SearchBar } from "./SearchBar";
import { SearchResultsPanel } from "./SearchResultsPanel";
import {
  applyMapFilters,
  mapFilterCount,
  mapFiltersAreActive,
  takeMapResultLimit,
} from "@/lib/map-filters-engine";
import { resetMapFilters, useMapFilters } from "@/lib/use-map-filters";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SearchMapFilters } from "./SearchMapFilters";
import type { AddState } from "./add-state";
import {
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
  shouldCenterRailCard,
  matchPredictionToPlace,
  newSessionToken,
  railCenterIndex,
  shouldReloadNearbyCatalog,
  viewportCenter,
  withDistances,
} from "./search-utils";

// Fast (Autocomplete) while typing, Deep once the guest stops. Deep only
// REPLACES Fast when it actually has rows — an empty Deep would blank a list
// the guest is already reading.
const FAST_DEBOUNCE_MS = 300;
const DEEP_IDLE_MS = 1000;
const MIN_QUERY = 2;

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
  // THE FILTERS CONTROL MOVED, IT DID NOT LEAVE (Pato, 2026-09-02). It came off
  // the top row earlier the same day for competing with the search bar, and the
  // next question was "where are the filters???" — so it lives in the BOTTOM
  // overlay now, beside the count it changes. SearchRailOverlay owns the pill.
  //
  // The store read comes back WITH it, and that pairing is the rule: while the
  // control was gone this read `MAP_FILTER_DEFAULTS`, because `useMapFilters`
  // persists in sessionStorage and a filter nobody can see is worse than one
  // they can. A visible control makes the persisted set legitimate again.
  const filters = useMapFilters();
  const scope = useSearchScope();
  const location = scope.locationOptOut ? null : userLocation;
  const center = location;

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

  // TYPED SEARCH LIVES HERE, on the map. A found place needs somewhere to
  // land, and on a bare list it lands nowhere.
  //
  // THERE IS NO "QUERY MODE". The map never stops being the map: the catalog
  // keeps loading, the camera keeps its own rules, and typing only swaps the
  // BOTTOM overlay and adds a pin layer. That is the difference from the
  // version this replaces, which put a fixed-height results lid over the pins.
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Bumped by Try again. The debounce effect keys on the query TEXT, so a
  // retry of the same string would otherwise be a no-op re-render.
  const [searchNonce, setSearchNonce] = useState(0);
  const trimmedQuery = query.trim();
  const querying = trimmedQuery.length >= MIN_QUERY || searching;

  // Search biases to the CAMERA, not the device: on a map you have panned to
  // another neighbourhood, results near your house are the wrong answer.
  const searchOrigin = cameraCenter ?? location ?? MONTERREY_CENTER;

  // Derived search state stays in the handler, not an effect — the
  // set-state-in-effect lint rule bars resetting it there, and flagging
  // `searching` on the keystroke is what stops the debounce window from
  // flashing an empty state between characters.
  const updateQuery = useCallback(
    (next: string) => {
      setQuery(next);
      const nextTrimmed = next.trim();
      if (nextTrimmed.length < MIN_QUERY) {
        // Google bills autocomplete per session, so a token that never rotates
        // is one unbounded session. Dropping below the threshold ends this run.
        // Minted inline rather than through resetSearchSession, which is
        // declared further down and would be in the TDZ from this dep array.
        if (trimmedQuery.length >= MIN_QUERY) {
          sessionTokenRef.current = newSessionToken();
        }
        setPredictions([]);
        setSearching(false);
        setSearchError(null);
      } else if (nextTrimmed !== trimmedQuery) {
        setSearching(true);
      }
    },
    [trimmedQuery],
  );

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY) return;
    let cancelled = false;
    let deepSettled = false;
    const token = sessionTokenRef.current;

    const fast = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmedQuery,
          token,
          searchOrigin,
          "fast",
        );
        if (cancelled || deepSettled) return;
        setPredictions(rows);
        setSearchError(null);
        // Empty Fast keeps `searching` true so Deep can fill without the list
        // flashing "no matches" in between.
        if (rows.length > 0) setSearching(false);
      } catch (err) {
        if (cancelled || deepSettled) return;
        setPredictions([]);
        setSearchError(errMsg(err, "Search failed — try again."));
        setSearching(false);
      }
    }, FAST_DEBOUNCE_MS);

    const deep = window.setTimeout(async () => {
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmedQuery,
          token,
          searchOrigin,
          "deep",
        );
        if (cancelled) return;
        // Empty Deep keeps Fast — Deep only REPLACES the list when it has
        // rows, so a slower, better query can never blank one the guest is
        // already reading.
        if (rows.length > 0) {
          deepSettled = true;
          setPredictions(rows);
          setSearchError(null);
        }
        setSearching(false);
      } catch {
        // Keep Fast results if Deep fails. A worse list beats no list.
        if (!cancelled) setSearching(false);
      }
    }, DEEP_IDLE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(fast);
      window.clearTimeout(deep);
    };
  }, [supabase, trimmedQuery, searchOrigin, searchNonce]);

  // The second pin source. null hands the map back its catalog pins, so the
  // basemap is never blank while you type — results ADD to what is there.
  const searchPins = useMemo(
    () => (querying ? buildSearchMapPins(predictions, catalog) : null),
    [querying, predictions, catalog],
  );

  const lastBoxRef = useRef<ViewportBox | null>(null);
  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastFetchedAtMs = useRef<number | null>(null);
  const reloadMinKmRef = useRef(CATALOG_RELOAD_MIN_KM);
  const reloadMinSecRef = useRef(CATALOG_RELOAD_MIN_SEC);
  const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceNextLoad = useRef(false);
  // A tap picked the card, so centre it even when the pager still names
  // it. A flick never sets this — scrollIntoView would fight the finger.
  const centerOnSelect = useRef(false);
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
      const nextCenter = viewportCenter(box);
      const gen = ++viewportGen.current;
      setCatalogLoading(true);
      setFetchError(null);
      try {
        // How many is asked ONCE, on the Filters sheet (Pato,
        // 2026-08-29): it is the cap the fetch itself obeys, so both
        // lanes and the merged union come back at N. The console has no
        // count knob left to disagree with.
        const result = await apiFetchNearbyCatalog(
          supabase,
          nextCenter,
          filters.resultLimit,
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
    // `markViewport` left this list with the search-open guard that used to
    // call it here — the overlay is gone, so a viewport load always loads.
    [filters.searchPower, filters.familyKeys, filters.resultLimit, supabase],
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
            if (!lastBoxRef.current) return;
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
      if (forceNextLoad.current) {
        forceNextLoad.current = false;
        clearPendingReload();
        void loadViewport(box);
        return;
      }
      scheduleOrLoad(box);
    },
    [clearPendingReload, loadViewport, markViewport, scheduleOrLoad],
  );

  useEffect(() => () => clearPendingReload(), [clearPendingReload]);

  // Places scope, Super Category and How many all change the Nearby
  // engine — How many is the fetch cap now, not a client slice. Super
  // pills pick Google includedPrimaryTypes. The query bar (Fast / Deep
  // Autocomplete) never reads these filters.
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
      // Selecting a place ends the Places session; mint the next token.
      resetSearchSession();
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
    // The suggest list was the other source of predictions; with the search
    // bar gone the stash is the only one left. It is still needed: a Google-only
    // catalog pin holds its prediction here between the select tap and the open.
    const prediction =
      heldOverlay &&
      (heldOverlay.placeId === pin.id || heldOverlay.mesitaId === pin.id)
        ? heldOverlay
        : null;
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
        // No rail card exists for an overlay pin, so do NOT open the
        // rail: defaultRailSelection would fall back to card 0 and the
        // guest who tapped B would watch A light up. Ring only.
        if (prediction) setHeldOverlay(prediction);
        setSelectedId(pin.id);
        return;
      case "select-mesita-catalog":
        setHeldOverlay(null);
        centerOnSelect.current = true;
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
    centerOnSelect.current = true;
    setRailCollapsed(false);
    setSelectedId(place.id);
  };

  // Center the rail card for the selected place once the rail is on screen.
  // Skip when the pager already names that card — scroll itself selected
  // it, and scrollIntoView would fight the flick.
  //
  // A TAP overrides that guard (Pato, 2026-08-29). Opening a collapsed
  // rail leaves railIndex stale at 0, so `idx === railIndex` was true for
  // card 0 and the tap scrolled nothing: the guest tapped a pin and the
  // carousel did not move. `centerOnSelect` marks the tap, survives the
  // render, and is cleared once honoured.
  useEffect(() => {
    if (railCollapsed || !railSelectedId) return;
    const idx = catalog.findIndex((p) => p.id === railSelectedId);
    if (!shouldCenterRailCard(idx, railIndex, centerOnSelect.current)) return;
    centerOnSelect.current = false;
    railRefs.current.get(railSelectedId)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [railCollapsed, railSelectedId, catalog, railIndex]);

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
        onFirstViewport={onFirstViewport}
        onUserViewport={onUserViewport}
      />

      {/* Floating top overlay — the search bar, and nothing beside it.

          ONE ROW, and now ONE CONTROL (Pato, 2026-09-02). This mode is the
          app's landing surface, so every pixel it spends on chrome is map a
          guest does not see: the mode rail is already above and the catalog
          rail is already below.

          Filters used to sit here, and the escalation is the tell — it went
          icon-only, then took its label, then went primary-filled to be
          seen. A control that has to keep shouting next to the one thing the
          guest actually came to use is competing with it, not supporting it.
          The bar now takes the full width. */}
      <div className="absolute inset-x-3 top-3 z-30 flex flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBar
              query={query}
              showClear={query.length > 0}
              onQueryChange={updateQuery}
              onClear={() => updateQuery("")}
              placeholder="Search places by name…"
            />
          </div>
        </div>

        {/* RESULTS DROP FROM THE BAR, the way every autocomplete does and the
            way the old standalone Search page stacked them: header band, then
            the list directly beneath it. Nesting them in this same flex column
            is what guarantees that — no top offset to keep in sync with the
            bar's height, and `inset-x-3` already lines the edges up.

            THE OLD REGRESSION WAS A FIXED HEIGHT, not the top anchor. A panel that
            claimed 70% of the viewport whether it held two rows or ten is what
            covered the map. `max-h` sizes to content, so three results take a
            third of the screen and the pins stay visible underneath — the
            overlays test pins the absence of a fixed height. */}
        {querying && (
          <div className="border-border bg-card/95 shadow-elev flex max-h-[55dvh] min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-xl">
            <SearchResultsPanel
              query={query}
              searching={searching}
              searchError={searchError}
              predictions={predictions}
              addStates={addStates}
              onPickMesita={handlePickMesita}
              onPickGoogle={handlePickGoogle}
              onClearSearch={() => updateQuery("")}
              onRetry={() => {
                setSearchError(null);
                setSearching(true);
                setSearchNonce((n) => n + 1);
              }}
            />
          </div>
        )}

        {fetchError && (
          <p className={cn(ERROR_BOX_CLASS, "rounded-xl backdrop-blur")}>
            {fetchError}
          </p>
        )}
      </div>

      {/* The catalog rail steps aside while a query is live: its cards are the
          nearby catalog, not the results, and showing both would be two lists
          answering different questions at once. */}
      {!querying && (
        <SearchRailOverlay
          idle
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
          filterCount={mapFilterCount(filters)}
          onOpenFilters={() => setFiltersOpen(true)}
          setRailCardRef={(placeId, el) => {
            railRefs.current.set(placeId, el);
          }}
        />
      )}

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

      {/* From-Google preview + Add. NOT search chrome: the catalog carries
          Google-only places (grey pins), so a pin or rail-card tap reaches
          this through handleOpenPlace. It outlived the search bar. */}
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
