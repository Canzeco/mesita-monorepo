"use client";

// Search — the consumer catalog map. Composition layer for the page:
//
//   • Base: SearchMap fills the body (partner/web pins + user dot).
//   • Top overlay: floating search bar. Far-right chip is country + location
//     (two knobs, one sheet). Discovery cuisine/when/rewards stay on Swipe.
//   • Bottom overlay (idle): horizontal catalog rail; tapping a map pin
//     highlights + scrolls to the matching rail card, tapping a card opens
//     the place page.
//   • Typing ≥2 chars runs consumer-web-suggest-places (debounced, one Google
//     session token per autocomplete session) and hangs a content-height
//     SearchResultsPanel under the bar. One merged lane, no source labels —
//     the colored point is membership (partner / listed / Google-only).
//     On-Mesita rows select the place on the map; Google-only rows open
//     GooglePlaceSheet.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import type { Place } from "@/lib/api/places";
import {
  apiFetchPlacesInBbox,
  LIST_PLACES_MAX,
} from "@/lib/api/places";
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
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
} from "@/lib/discovery-filters-engine";
import { useDiscoveryFilters } from "@/lib/use-discovery-filters";
import { DiscoveryFilters } from "@/components/consumer/DiscoveryFilters";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useSearchScope } from "@/lib/use-search-scope";
import { SearchMap, type SearchMapPin, type ViewportBox } from "./SearchMap";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { GooglePlaceSheet } from "./GooglePlaceSheet";
import { SearchBar } from "./SearchBar";
import { SearchScopeSheet } from "./SearchScopeSheet";
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
import { buildSearchMapPins } from "@/lib/search-membership";

// ≥300ms so a fast typist costs one Google autocomplete call per pause,
// not one per keystroke.
const SUGGEST_DEBOUNCE_MS = 300;
const VIEWPORT_IDLE_MS = 1000;
const MIN_SUGGEST_QUERY_LENGTH = 2;

export function SearchClient({ apiKey }: { apiKey: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  const [places, setPlaces] = useState<Place[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [overspan, setOverspan] = useState(false);
  const [totalInBox, setTotalInBox] = useState<number | null>(null);
  const viewportGen = useRef(0);
  const userViewportTimer = useRef<number | null>(null);
  // Google Places session token. Per Google's session-billing semantics a
  // session spans the keystrokes up to ONE selection — so the token is
  // regenerated after every selection (Info / Add tap) and whenever the
  // results panel is dismissed, scoping each autocomplete run properly.
  const sessionTokenRef = useRef(newSessionToken());
  const railRefs = useRef(new Map<string, HTMLButtonElement | null>());
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [freshFix, setFreshFix] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);
  const scope = useSearchScope();
  const deviceLocation = freshFix ?? userLocation;
  const location = scope.locationOptOut ? null : deviceLocation;

  const trimmed = query.trim();
  // Idle = the map moment: no text query, search panel closed. The catalog
  // rail only exists here; the results dropdown owns the other state.
  const idle = trimmed.length === 0 && !searchOpen;

  // Location (not country) centers the map and distances. Discovery zone
  // stays a Swipe predicate — it does not drive this bar.
  const center = location;
  const catalog = useMemo(
    () => withDistances(places, center),
    [places, center],
  );
  const visible = useMemo(() => {
    const filtered = applyDiscoveryFilters(catalog, filters);
    if (!selectedId) return filtered;
    if (filtered.some((p) => p.id === selectedId)) return filtered;
    // An explicit Search pick wins the cut: the pin and rail card must
    // still appear, or the tap looks like a no-op with filters on.
    const picked = catalog.find((p) => p.id === selectedId);
    return picked ? [picked, ...filtered] : filtered;
  }, [catalog, filters, selectedId]);
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(places),
    [places],
  );

  const searchPins = useMemo(
    () => buildSearchMapPins(predictions, catalog),
    [predictions, catalog],
  );

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
          center,
          scope.country,
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
  }, [supabase, trimmed, center, scope.country]);

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

  const handleSelectPin = (pin: SearchMapPin) => {
    const prediction = predictions.find(
      (p) => p.mesitaId === pin.id || p.placeId === pin.id,
    );
    if (prediction && prediction.status === "not_in_mesita") {
      handlePickGoogle(prediction);
      return;
    }
    if (prediction) {
      handlePickMesita(prediction);
      return;
    }
    const place = catalog.find((p) => p.id === pin.id);
    if (place) {
      setRailCollapsed(false);
      setSelectedId(place.id);
    }
  };

  // The REAL Add flow: the place is created immediately; only enrichment is
  // scheduled (the cron-driven Intaker pipeline finishes asynchronously),
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

  const handleUseLocation = () => {
    setLocating(true);
    scope.setLocationOptOut(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      toast.error("Location isn't available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFreshFix({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't read your location.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  };

  const dismissSearch = () => {
    updateQuery("");
    setSearchOpen(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    // Focus after the panel mounts so the keyboard comes up on tap-to-open
    // (map tap or bar tap) without covering the map in a 70% sheet.
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleMapClick = () => {
    // Bare map tap toggles search: open when idle, close when the dropdown
    // (empty prompt or live results) is covering the top of the canvas.
    if (searchOpen || trimmed.length > 0) {
      dismissSearch();
      return;
    }
    openSearch();
  };

  const handleOpenPlace = (place: Place) =>
    router.push(placeHref(place.slug || place.id));

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {/* Base layer — pins reflect the same filter cut as the rail. */}
      <SearchMap
        apiKey={apiKey}
        places={visible}
        userLocation={userLocation}
        viewCenter={center}
        selectedId={selectedId}
        pins={searchPins}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        onSelectPin={handleSelectPin}
        onMapClick={handleMapClick}
      />

      {/* Floating top overlay — search bar, then a content-height dropdown
          (empty prompt or live results) that never uses a fixed 70% panel.
          max-h-[70%] caps long lists so they scroll and the map stays visible
          below. Ask AI lives on Home › Chat. */}
      <div className="absolute inset-x-3 top-3 z-30 flex max-h-[70%] flex-col gap-2">
        <SearchBar
          query={query}
          showClear={Boolean(query || searchOpen)}
          onQueryChange={updateQuery}
          onFocus={openSearch}
          onClear={dismissSearch}
          inputRef={searchInputRef}
          onOpenScope={() => setScopeOpen(true)}
          countryCode={scope.country}
          locationSet={location != null}
        />

        {fetchError && idle && (
          <p className={cn(ERROR_BOX_CLASS, "rounded-xl backdrop-blur")}>
            {fetchError}
          </p>
        )}

        {(searchOpen || trimmed.length > 0) && (
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
        places={visible}
        catalogCount={catalog.length}
        filtersActive={filtersActive}
        railCollapsed={railCollapsed}
        railIndex={railIndex}
        selectedId={selectedId}
        railScrollRef={railScrollRef}
        onShowRail={() => setRailCollapsed(false)}
        onHideRail={() => setRailCollapsed(true)}
        onRailScroll={handleRailScroll}
        onSelectPlace={handleSelectPlace}
        onOpenPlace={handleOpenPlace}
        onOpenFilters={() => setFiltersOpen(true)}
        setRailCardRef={(placeId, el) => {
          railRefs.current.set(placeId, el);
        }}
      />

      <LocalSheet
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        ariaLabel="Place search"
      >
        <SearchScopeSheet
          country={scope.country}
          locationSet={location != null}
          locating={locating}
          onCountry={scope.setCountry}
          onUseLocation={handleUseLocation}
          onClearLocation={() => {
            scope.setLocationOptOut(true);
            setFreshFix(null);
          }}
          onClose={() => setScopeOpen(false)}
        />
      </LocalSheet>

      <LocalSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        ariaLabel="Filters"
      >
        <DiscoveryFilters
          onClose={() => setFiltersOpen(false)}
          categoryOptions={categoryOptions}
          count={visible.length}
          hasLocation={userLocation != null}
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
