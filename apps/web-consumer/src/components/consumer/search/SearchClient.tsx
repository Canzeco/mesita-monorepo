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
// EVERY BAR PICK ANCHORS THE MAP (MESITA-1405). Picking a Location or a
// Place moves the camera to its coordinates and reloads the catalog there;
// a Place becomes card ONE of the carousel — prepended after the operator's
// cap, which governs the map query only — and its modal is
// one more tap away, on the card or its pin. A Location (kind: "location")
// is a camera destination: coordinates + viewport resolve on pick, never
// per keystroke, and the viewport picks the zoom.
//
// A Google-only result has no preview sheet and no Add button (MESITA-2298):
// its SECOND tap (pin or rail card) is the explicit open — get-or-create on
// the Google Place ID, then the profile. The catalog itself carries
// Google-only places (the grey pins), so a pin or rail-card tap reaches
// that through handleOpenPlace, and `heldOverlay` still stashes a
// prediction between the select tap and the open. No photo is fetched for
// a Google-only card, here or anywhere.
//
// Composition:
//   • Base: SearchMap fills the body (red Mesita Places, gray Google, blue
//     user). Catalog pins by default; `searchPins` overlays
//     the predictions while a query is live.
//   • Top overlay: the search bar (two thirds) + labelled Filters (one
//     third: Family, Places scope, Popularity). How many is
//     operator the scope's cap (`map.googlePlaces` / `map.mesitaPlaces`).
//   • Bottom overlay: the catalog rail around the camera, hidden while
//     querying. Closest first. A guest move reloads once the map has been
//     still for reloadIdleSec and travelled RELOAD_MIN_KM (MESITA-2440).
//     Only the guest's own moves count as travel — a tap's reveal pan
//     rebases the km origin so click-by-click browsing cannot add up. The
//     rail's centre card is always the selected pin.
//
// THE CAMERA NEVER TELEPORTS (MESITA-2440): it moves only on an explicit
// ask, as a CameraIntent — the rules live in camera-intent.ts. A rail
// scroll rings the pin and leaves the map where the guest put it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import { apiFetchNearbyCatalog } from "@/lib/api/places";
import {
  apiResolveLocationAnchor,
  apiSuggestPlacesWithIdle,
  type PlacePrediction,
} from "@/lib/api/place-search";
import {
  useLocateUser,
  useOnUserFix,
  useUserLocation,
  useUserLocationLocating,
  type Coords,
} from "@/lib/use-user-location";
import { MAP_USER_ZOOM, MONTERREY_CENTER } from "@/lib/map-defaults";
import { placeHref } from "@/lib/place-route";
import { useOpenGooglePlace } from "@/lib/use-open-google-place";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { useMapFilters } from "@/lib/use-map-filters";
import { useAreaPrefer } from "@/lib/use-area-prefer";
import {
  buildSearchMapPins,
  catalogPlaceOnMesita,
  overlayPinDecision,
  predictionOnMesita,
} from "./search-pins";
import {
  mapFingerIsDown,
  SearchMap,
  type SearchMapPin,
  type ViewportBox,
} from "./SearchMap";
import {
  clampReloadIdleSec,
  gpsFixMovesCamera,
  idleReloadDue,
  RELOAD_IDLE_SEC_DEFAULT,
  selectionMovesCamera,
  type CameraIntent,
  type SelectionSource,
} from "./camera-intent";
import { SearchBar } from "./SearchBar";
import { SearchHeader } from "./SearchHeader";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { AddState } from "./add-state";
import { SearchRailOverlay } from "./search-catalog-overlays";
import { SearchLocateButton } from "./SearchLocateButton";
import {
  anchorPlaceFromPrediction,
  anchorSurvivesReload,
  anchorViewportBounds,
  catalogIsStale,
  defaultRailSelection,
  shouldCenterRailCard,
  matchPredictionToPlace,
  newSessionToken,
  prependAnchorPlace,
  railCenterIndex,
  viewportCenter,
  withDistances,
} from "./search-utils";

// Word is ONE search (MESITA-2322): Deep (Autocomplete · Text Search ·
// Mesita names) once the guest has stopped typing for Discovery › Word's
// idle seconds. The EF returns that number with every answer; until the
// first answer the bar waits DEFAULT_IDLE_MS.
const DEFAULT_IDLE_MS = 1000;
const MIN_QUERY = 2;

/**
 * A live searchbar pick (MESITA-1405). `place` is the chosen place for card
 * ONE of the carousel — null for a Location, which is a camera destination,
 * never a card. The camera move itself is a CameraIntent.
 */
type AnchorPick = {
  place: Place | null;
};

/** Omit over each member of a union, keeping it a union. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

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
    state: "not_in_mesita",
    lat: place.lat,
    lng: place.lng,
  };
}

export function SearchClient({ apiKey }: { apiKey: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  const locating = useUserLocationLocating();
  const locate = useLocateUser();
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
  const openGooglePlace = useOpenGooglePlace();
  const sessionTokenRef = useRef(newSessionToken());
  // Word's idle wait, refreshed from every answer (MESITA-2322).
  const idleMsRef = useRef(DEFAULT_IDLE_MS);
  const railRefs = useRef(new Map<string, HTMLElement | null>());
  const railScrollRef = useRef<HTMLDivElement | null>(null);

  // The opening screen owns get-or-create now (MESITA-2311), so these stay
  // empty: no Search row is mid-add, and a re-tap goes back through it.
  const [addStates] = useState<Record<string, AddState>>({});
  const [addedProfiles] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Overlay pin first-tap stash so a later tap can still open (the profile,
  // through get-or-create for a Google-only row) after the suggest list is
  // gone. Holds Google and overlay-only Mesita predictions — keyed on pin.id.
  const [heldOverlay, setHeldOverlay] = useState<PlacePrediction | null>(null);
  // 0-based position of the card nearest the rail's scroll start (shown
  // 1-based) — powers the "3 / 12 places" pager so the horizontal rail
  // reads as browsable.
  const [railIndex, setRailIndex] = useState(0);
  // The bottom rail can be dismissed (X on the counter) to clear the map;
  // it reopens via the floating reopen pill or by tapping any pin.
  const [railCollapsed, setRailCollapsed] = useState(false);
  // The family chips (All, or one family) ride this store and the nearby
  // call. How many, the circle and the Google reviews minimum are the
  // operator's (Admin › Discovery). The server is the one selector — this
  // component never recuts the catalog.
  const filters = useMapFilters();
  // A family is the Family mode (MESITA-2428); Nearby and Popular are
  // every family (MESITA-2426).
  const storedPrefer = useAreaPrefer();
  const prefer = filters.familyKeys.length > 0 ? "family" : storedPrefer;
  const location = userLocation;
  // THE ONE CAMERA CHANNEL (MESITA-2440). Every move the guest asked for —
  // first load, the location disc, a tap, a bar pick — is a fresh intent;
  // nothing else moves the map. `gen` makes a repeat ask fire again.
  const [cameraIntent, setCameraIntent] = useState<CameraIntent | null>(null);
  const cameraGen = useRef(0);
  const askCamera = useCallback(
    (intent: DistributiveOmit<CameraIntent, "gen">) => {
      cameraGen.current += 1;
      setCameraIntent({ ...intent, gen: cameraGen.current } as CameraIntent);
    },
    [],
  );
  // Has the guest moved the map themselves, or picked from the bar? Then
  // the first GPS fix no longer gets to centre it.
  const userMovedRef = useRef(false);
  const pickedRef = useRef(false);
  // The location disc was tapped with no fix yet: the fix that answers it
  // centres the map.
  const locateAskedRef = useRef(false);

  // EVERY searchbar pick anchors the map (MESITA-1405): camera to the
  // coordinates, catalog reload there, chosen Place as card ONE. Cleared
  // when a reload lands away from the anchored place — the guest moved on.
  const [anchor, setAnchor] = useState<AnchorPick | null>(null);

  // Distances follow the camera the catalog was fetched for, so a pan
  // ranks and labels the same nearby set. GPS still recenters the map.
  const distanceCenter = cameraCenter ?? location;
  const nearby = useMemo(
    () => withDistances(places.map(enrichPlaceOverview), distanceCenter),
    [places, distanceCenter],
  );
  // The EF already applied the operator's cap, so the catalog IS what came
  // back. The anchored pick still prepends after it, because the bar never
  // obeyed the map's set: a guest looking at a thin operator ring must still
  // land on the Google-only place they typed. Dedupe decides the total — N
  // unique when the pick is inside the N, N + 1 when outside.
  const catalog = useMemo(() => {
    const anchorRow = anchor?.place
      ? withDistances([enrichPlaceOverview(anchor.place)], distanceCenter)[0]
      : null;
    return prependAnchorPlace(nearby, anchorRow);
  }, [nearby, anchor, distanceCenter]);
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

  // THE CHROME REACTS TO THE KEYBOARD, not to the query length. `querying`
  // starts at two characters, which is the wrong moment twice over: the
  // keyboard is already up at zero, and it is still up while the guest deletes
  // back down to one.
  //
  // LOCAL STATE, not a shared context (MESITA-1616, was DiscoverChromeProvider
  // until Search moved to its own route). That context existed only to let
  // Home's mode rail — a SIBLING under the old shared discover/layout.tsx —
  // collapse in sync with this flag. Search has no siblings to coordinate
  // with any more, so the flag only ever needs to answer to this component.
  //
  // A LIVE QUERY KEEPS IT OPEN AFTER BLUR. Picking a result blurs the field,
  // and camera-move-triggered UI that snaps back in the same frame reads as
  // a flicker — so this stays true until the query is really gone.
  const [barFocused, setBarFocused] = useState(false);
  const searchMode = barFocused || querying;

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
    const token = sessionTokenRef.current;

    const search = window.setTimeout(async () => {
      try {
        const { predictions: rows, idleSec } = await apiSuggestPlacesWithIdle(
          supabase,
          trimmedQuery,
          token,
          searchOrigin,
          "deep",
        );
        if (idleSec !== null) idleMsRef.current = Math.round(idleSec * 1000);
        if (cancelled) return;
        setPredictions(rows);
        setSearchError(null);
        setSearching(false);
      } catch (err) {
        if (cancelled) return;
        setPredictions([]);
        setSearchError(errMsg(err, "Search failed — try again."));
        setSearching(false);
      }
    }, idleMsRef.current);

    return () => {
      cancelled = true;
      window.clearTimeout(search);
    };
  }, [supabase, trimmedQuery, searchOrigin, searchNonce]);

  // The second pin source. null hands the map back its catalog pins, so the
  // basemap is never blank while you type — results ADD to what is there.
  const searchPins = useMemo(
    () => (querying ? buildSearchMapPins(predictions, catalog) : null),
    [querying, predictions, catalog],
  );

  const lastBoxRef = useRef<ViewportBox | null>(null);
  // Where the catalog was last ASKED for — set when the request leaves, so
  // a fix landing mid-flight compares against the load already coming.
  const lastFetchedCenter = useRef<{ lat: number; lng: number } | null>(null);
  const reloadIdleMsRef = useRef(RELOAD_IDLE_SEC_DEFAULT * 1000);
  const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A tap picked the card, so centre it even when the pager still names
  // it. A flick never sets this — scrollIntoView would fight the finger.
  const centerOnSelect = useRef(false);

  const clearPendingReload = useCallback(() => {
    if (pendingReload.current == null) return;
    clearTimeout(pendingReload.current);
    pendingReload.current = null;
  }, []);

  const markViewport = useCallback((box: ViewportBox) => {
    lastBoxRef.current = box;
  }, []);

  const loadAt = useCallback(
    async (nextCenter: Coords) => {
      lastFetchedCenter.current = nextCenter;
      const gen = ++viewportGen.current;
      setCatalogLoading(true);
      setFetchError(null);
      try {
        const result = await apiFetchNearbyCatalog(
          supabase,
          nextCenter,
          filters.familyKeys,
          prefer,
        );
        if (gen !== viewportGen.current) return;
        reloadIdleMsRef.current =
          clampReloadIdleSec(result.reloadIdleSec) * 1000;
        setCameraCenter(nextCenter);
        setPlaces(result.places);
        // A reload centered away from the anchored place ends the anchor —
        // the guest moved on. The pick's own forced load (and a filter
        // refetch at the same spot) lands ON the place, so it survives. A
        // Location anchor has no card to keep and clears with its load.
        setAnchor((a) =>
          a?.place && anchorSurvivesReload(a.place, nextCenter) ? a : null,
        );
      } catch (err) {
        if (gen !== viewportGen.current) return;
        setFetchError(errMsg(err, "Couldn't load places in this area."));
      } finally {
        if (gen === viewportGen.current) setCatalogLoading(false);
      }
    },
    // `markViewport` left this list with the search-open guard that used to
    // call it here — the overlay is gone, so a viewport load always loads.
    [filters.familyKeys, prefer, supabase],
  );

  // RELOAD ONCE THE MAP IS STILL (MESITA-2440, Pato: "reload after x
  // seconds without moving"). A guest move arms one timer; any camera move
  // cancels it (SearchMap's onCameraMoveStart) and the idle that ends that
  // move arms it again. A finger resting on the map defers it.
  const armIdleReload = useCallback(() => {
    clearPendingReload();
    const fire = () => {
      if (mapFingerIsDown()) {
        pendingReload.current = setTimeout(fire, reloadIdleMsRef.current);
        return;
      }
      pendingReload.current = null;
      const box = lastBoxRef.current;
      if (!box) return;
      const next = viewportCenter(box);
      if (!idleReloadDue(lastFetchedCenter.current, next)) return;
      void loadAt(next);
    };
    pendingReload.current = setTimeout(fire, reloadIdleMsRef.current);
  }, [clearPendingReload, loadAt]);

  const onFirstViewport = useCallback(
    (box: ViewportBox) => {
      lastBoxRef.current = box;
      void loadAt(viewportCenter(box));
    },
    [loadAt],
  );

  const onUserViewport = useCallback(
    (box: ViewportBox, meta: { programmatic: boolean }) => {
      markViewport(box);
      if (meta.programmatic) {
        // A move the page made (a tap's reveal, the disc, a bar pick) does
        // not travel. Rebase the km origin so click-by-click catalog
        // browsing cannot accumulate toward reload; an ask that needed a
        // new catalog already loaded it at its target.
        lastFetchedCenter.current = viewportCenter(box);
        clearPendingReload();
        return;
      }
      userMovedRef.current = true;
      if (!idleReloadDue(lastFetchedCenter.current, viewportCenter(box))) {
        clearPendingReload();
        return;
      }
      armIdleReload();
    },
    [armIdleReload, clearPendingReload, markViewport],
  );

  useEffect(() => () => clearPendingReload(), [clearPendingReload]);

  // Family and Near/Popular change the Area pool (`loadAt` changes with
  // them). How many stays the operator's. The query bar never reads these
  // filters.
  useEffect(() => {
    if (!lastFetchedCenter.current || !lastBoxRef.current) return;
    clearPendingReload();
    void loadAt(viewportCenter(lastBoxRef.current));
  }, [clearPendingReload, loadAt]);

  // A GPS FIX MOVES THE BLUE DOT, NOT THE MAP (MESITA-2440). Only the fix
  // the location disc asked for, or the first one when nothing else has
  // claimed the camera (first load), centres it — and then the catalog
  // follows if it was loaded somewhere else. Every later fix is ignored
  // here: that late fix yanking the camera home was the teleport.
  const firstFixSeen = useRef(location !== null);
  useOnUserFix(
    useCallback(
      (fix: Coords) => {
        const firstFix = !firstFixSeen.current;
        firstFixSeen.current = true;
        const asked = locateAskedRef.current;
        locateAskedRef.current = false;
        if (
          !gpsFixMovesCamera({
            asked,
            firstFix,
            userMoved: userMovedRef.current,
            picked: pickedRef.current,
          })
        ) {
          return;
        }
        askCamera(
          asked
            ? { kind: "center", lat: fix.lat, lng: fix.lng }
            : {
                kind: "center",
                lat: fix.lat,
                lng: fix.lng,
                minZoom: MAP_USER_ZOOM,
              },
        );
        if (catalogIsStale(lastFetchedCenter.current, fix)) {
          clearPendingReload();
          void loadAt(fix);
        }
      },
      [askCamera, clearPendingReload, loadAt],
    ),
  );

  // The location disc (MESITA-2298): with a fix, centre on the guest
  // (their zoom stays) and, when the catalog was fetched elsewhere, reload
  // there. Without a fix, ask — the answer centres (useOnUserFix above).
  const recentreOnGuest = useCallback(() => {
    if (!location) {
      locateAskedRef.current = true;
      locate();
      return;
    }
    askCamera({ kind: "center", lat: location.lat, lng: location.lng });
    if (catalogIsStale(lastFetchedCenter.current, location)) {
      clearPendingReload();
      void loadAt(location);
    }
  }, [askCamera, clearPendingReload, loadAt, location, locate]);

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

  // Get-or-create (MESITA-2298): the explicit open is the ONLY call that
  // creates a Mesita Place. A held Google Place ID comes back `created:
  // false` and opens as is; a new one is live immediately, ugly, and waits
  // for votes on the Enrich tab. Nothing creates on render or on a pin tap.
  // Reached only from `openGoogleOnly`. The tap goes to the opening screen at
  // once (MESITA-2311), which draws the card the guest tapped as the profile
  // with Google's photo and "Creating profile" in the body while
  // get-or-create runs there, then becomes the profile (MESITA-2307). The
  // catalog row rides along when the open came from a pin or a rail card;
  // a bare prediction carries its name and address.
  const openGoogleProfile = useCallback(
    (prediction: PlacePrediction, card?: Place) => {
      resetSearchSession();
      openGooglePlace(
        card ?? {
          name: prediction.mainText,
          google_place_id: prediction.placeId,
          address: prediction.secondaryText || null,
        },
      );
    },
    [openGooglePlace, resetSearchSession],
  );

  // Pin / rail-card SECOND tap on a from-Google row = THE EXPLICIT OPEN
  // (MESITA-2298): a row this session already opened goes straight to its
  // profile; a Mesita row opens as Mesita; a Google-only row runs
  // get-or-create and opens. No preview, no photo, no Add button. The bar
  // pick never lands here — it anchors.
  const openGoogleOnly = (prediction: PlacePrediction, card?: Place) => {
    const fromAdd = addedProfiles[prediction.placeId];
    if (fromAdd) {
      resetSearchSession();
      router.push(placeHref(fromAdd));
      return;
    }
    if (predictionOnMesita(prediction)) {
      openMesitaProfileFromPrediction(prediction);
      return;
    }
    openGoogleProfile(prediction, card);
  };

  // One pick = one camera move + one reload at the pick + (for a Place)
  // card ONE. Clearing the query dismisses the results panel, brings the
  // rail back, and rotates the Places billing session — a pick ends a
  // session. The reload goes out at once, for the pick's coordinates: the
  // Area pool is asked by its centre, so it need not wait for the pan.
  const anchorMapTo = (
    camera: {
      lat: number;
      lng: number;
      bounds?: {
        south: number;
        west: number;
        north: number;
        east: number;
      } | null;
    },
    place: Place | null,
  ) => {
    pickedRef.current = true;
    askCamera(
      camera.bounds
        ? { kind: "fit", bounds: camera.bounds }
        : { kind: "center", lat: camera.lat, lng: camera.lng },
    );
    clearPendingReload();
    void loadAt({ lat: camera.lat, lng: camera.lng });
    setAnchor({ place });
    if (place) {
      setHeldOverlay(null);
      centerOnSelect.current = true;
      setRailCollapsed(false);
      setSelectedId(place.id);
    } else {
      // A Location has no card: drop any lingering explicit selection so
      // nothing pans the camera off the freshly fitted viewport.
      setSelectedId(null);
    }
    updateQuery("");
  };

  // EVERY BAR PICK ANCHORS THE MAP — both entities (MESITA-1405). A Place
  // stops opening its modal from the bar: the camera lands on the place,
  // the catalog reloads there, and the modal is one more tap away on the
  // card or its pin. A Google-only pick anchors too — the sheet moves to
  // the second tap, the gesture the grey pin already speaks, so the rule
  // has no exception to learn. The operator's cap never vetoes any of it.
  const handleBarPick = (prediction: PlacePrediction) => {
    if (prediction.kind === "location") {
      // A Location is a camera destination, never a card. Coordinates are
      // resolved ON PICK — one Details call per selection, never per
      // keystroke — and the viewport decides the zoom: a city opens wide,
      // a neighbourhood close.
      void (async () => {
        try {
          const resolved = await apiResolveLocationAnchor(
            supabase,
            prediction.placeId,
          );
          anchorMapTo(
            {
              lat: resolved.lat,
              lng: resolved.lng,
              bounds: anchorViewportBounds(resolved.viewport),
            },
            null,
          );
        } catch (err) {
          toast.error(errMsg(err, "Couldn't open that location right now."));
        }
      })();
      return;
    }
    // The catalog's own row wins the card — it carries photos and the
    // real distance. The synthesized stub covers picks outside the
    // snapshot; either way the EF already shipped coordinates on the row.
    const own =
      (prediction.mesitaId
        ? nearby.find((p) => p.id === prediction.mesitaId)
        : null) ??
      nearby.find(
        (p) =>
          (p.google_place_id ??
            (p.googleOnly || p.from_google ? p.slug : null)) ===
          prediction.placeId,
      ) ??
      matchPredictionToPlace(prediction, nearby);
    const anchorRow =
      own && typeof own.lat === "number" && typeof own.lng === "number"
        ? own
        : anchorPlaceFromPrediction(prediction);
    if (
      !anchorRow ||
      typeof anchorRow.lat !== "number" ||
      typeof anchorRow.lng !== "number"
    ) {
      // No coordinates anywhere — a camera cannot anchor nowhere. The
      // rare coordinate-less Mesita row keeps the direct-open fallback.
      resetSearchSession();
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(placeHref(direct));
        return;
      }
      toast(
        "This place is on Mesita but isn't in the map snapshot yet — opening it from search is coming soon.",
      );
      return;
    }
    anchorMapTo({ lat: anchorRow.lat, lng: anchorRow.lng }, anchorRow);
  };

  const handleOpenPlace = (place: Place) => {
    const google = googlePredictionFromPlace(place);
    if (google) {
      // The explicit open is the SECOND tap on a pin or card the guest
      // chose (MESITA-2298 §5). `railSelectedId` also carries the card-0
      // fallback nobody tapped, so a first tap there reads as an open to
      // the map and the rail; for a Google-only row that tap must only
      // select — a create on one tap is what the spec forbids (MESITA-2305).
      if (selectedId !== place.id) {
        handleSelectPlace(place);
        return;
      }
      openGoogleOnly(google, place);
      return;
    }
    router.push(placeHref(place.slug || place.id));
  };

  // A tap asks the camera to REVEAL the place: a pan only if it is
  // off-screen (or under the rail), never a zoom.
  const revealSelection = (
    source: SelectionSource,
    at: { lat?: number | null; lng?: number | null },
  ) => {
    if (!selectionMovesCamera(source)) return;
    if (typeof at.lat !== "number" || typeof at.lng !== "number") return;
    askCamera({ kind: "reveal", lat: at.lat, lng: at.lng });
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
        if (prediction) openGoogleOnly(prediction);
        return;
      case "open-catalog":
        if (place) handleOpenPlace(place);
        return;
      case "open-mesita-slug":
        if (prediction) openMesitaProfileFromPrediction(prediction);
        return;
      case "select-google":
      case "select-mesita-overlay":
        // No rail card exists for an overlay pin, so do NOT open the
        // rail: defaultRailSelection would fall back to card 0 and the
        // guest who tapped B would watch A light up. Ring only.
        if (prediction) setHeldOverlay(prediction);
        setSelectedId(pin.id);
        revealSelection("pin", pin);
        return;
      case "select-mesita-catalog":
        // A pin gesture, not a bar pick — select the card, never anchor.
        centerOnSelect.current = true;
        if (place) {
          setHeldOverlay(googlePredictionFromPlace(place));
          setRailCollapsed(false);
          setSelectedId(place.id);
          revealSelection("pin", place);
        } else {
          setHeldOverlay(null);
        }
        return;
      case "noop":
        return;
    }
  };

  const handleRailScroll = () => {
    const el = railScrollRef.current;
    if (!el || catalog.length === 0) return;
    const page = el.clientWidth * 0.8;
    if (page <= 0) return;
    const next = railCenterIndex(el.scrollLeft, page, catalog.length);
    setRailIndex(next);
    const id = catalog[next]?.id;
    // A SCROLL RINGS THE PIN, IT NEVER PANS (MESITA-2440): browsing the
    // rail must not drag the map out from under the guest.
    if (id) setSelectedId(id);
  };

  // Pin or rail-card tap → highlight + scroll the rail to the matching
  // card. Tapping a pin also reopens the rail if it was dismissed. The map
  // pans only when the place is off-screen (camera-intent.ts).
  const handleSelectPlace = (place: Place) => {
    setHeldOverlay(googlePredictionFromPlace(place));
    centerOnSelect.current = true;
    setRailCollapsed(false);
    setSelectedId(place.id);
    revealSelection("card", place);
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search's header, a white band over the map (Pato, MESITA-2409/2413):
        location disc · query bar · Ask AI, then the family chips; the bar's
        results and the load error hang over the map's top edge. The pair that keeps the disc
        visible: `min-w-0 flex-1` on the bar, `shrink-0` on the disc. */}
      <SearchHeader
        locate={
          <SearchLocateButton
            located={location !== null}
            locating={locating}
            onClick={recentreOnGuest}
          />
        }
        bar={
          <SearchBar
            query={query}
            showClear={query.length > 0}
            onQueryChange={updateQuery}
            onFocus={() => setBarFocused(true)}
            onBlur={() => setBarFocused(false)}
            onClear={() => updateQuery("")}
          />
        }
      >
        {/* RESULTS DROP UNDER THE BAR, the way every autocomplete does, and
          COVER the chip row (Pato, MESITA-2417): the header anchors them on
          the chips' box, so there is no top offset to keep in sync.

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
              onPick={handleBarPick}
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
      </SearchHeader>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Base layer — pins are the nearby catalog after Places scope + Family. */}
        <SearchMap
          apiKey={apiKey}
          places={catalog}
          userLocation={userLocation}
          selectedId={railSelectedId}
          pins={searchPins}
          // The camera moves on intents only; railSelectedId (and its card-0
          // fallback) rings a pin and never pans.
          cameraIntent={cameraIntent}
          onSelectPlace={handleSelectPlace}
          onOpenPlace={handleOpenPlace}
          onSelectPin={handleSelectPin}
          onFirstViewport={onFirstViewport}
          onUserViewport={onUserViewport}
          onCameraMoveStart={clearPendingReload}
        />

        {/* The catalog rail steps aside for the whole of search mode: its cards
          are the nearby catalog, not the results, so showing both would be two
          lists answering different questions at once — and on a phone the
          keyboard is already covering the half of the map they shared. */}
        {!searchMode && (
          <SearchRailOverlay
            places={catalog}
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
            setRailCardRef={(placeId, el) => {
              railRefs.current.set(placeId, el);
            }}
          />
        )}
      </div>
    </div>
  );
}
