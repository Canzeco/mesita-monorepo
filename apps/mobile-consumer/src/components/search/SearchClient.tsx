import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GooglePlaceSheet } from '@/components/search/GooglePlaceSheet';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchScopeSheet } from '@/components/search/SearchScopeSheet';
import {
  EmptySearchPrompt,
  IdleCatalogRail,
} from '@/components/search/SearchCatalogRail';
import { SearchMap, type SearchMapPin } from '@/components/search/SearchMap';
import {
  SearchResultsPanel,
  type SearchFailureKind,
} from '@/components/search/SearchResultsPanel';
import type { AddState } from '@/components/memo/types';
import { EFError } from '@/lib/ef';
import { SHADOW_ELEV } from '@/constants/brand';
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from '@/lib/api/place-search';
import {
  apiFetchNearbyPlaces,
  SEARCH_NEARBY_LIMIT,
  type Place,
} from '@/lib/api/places';
import { MONTERREY_CENTER } from '@/lib/map-defaults';
import { publishFiltersHostContext } from '@/lib/filters-host-context';
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
} from '@/lib/discovery-filters-engine';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { enrichPlaceOverview } from '@/lib/place-overview';
import { newSessionToken, withDistances } from '@/lib/search-utils';
import { buildSearchMapPins, catalogPlaceOnMesita, overlayPinDecision, predictionOnMesita } from '@/lib/search-membership';
import { useSearchScope } from '@/lib/use-search-scope';
import { supabase } from '@/lib/supabase';
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';
import { errMsg } from '@/lib/utils';

const FAST_DEBOUNCE_MS = 300;
const DEEP_IDLE_MS = 1000;
const GMP_KEY = process.env.EXPO_PUBLIC_GMP_KEY ?? '';

type Coords = { lat: number; lng: number };

function googlePredictionFromPlace(place: Place): PlacePrediction | null {
  const placeId = place.google_place_id;
  if (!place.from_google || !placeId) return null;
  if (catalogPlaceOnMesita(place)) return null;
  return {
    placeId,
    mainText: place.name,
    secondaryText: place.address ?? '',
    status: 'not_in_mesita',
  };
}

/**
 * Which failure the results panel should explain. `timeout` and `network` get
 * their own copy + a Retry button; everything else falls back to the EF's own
 * message. An EFError with no `status` never reached Mesita (offline / DNS),
 * so it reads as a network problem rather than a server fault.
 */
function classifyFailure(err: unknown): SearchFailureKind {
  if (err instanceof EFError) return err.status == null ? 'network' : 'server';
  if (err instanceof Error) {
    if (err.name === 'AbortError' || /timed?\s?out/i.test(err.message)) {
      return 'timeout';
    }
    if (/network|failed to fetch|fetch failed/i.test(err.message)) {
      return 'network';
    }
  }
  return 'server';
}

export function SearchClient() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionTokenRef = useRef(newSessionToken());

  const [places, setPlaces] = useState<Place[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [failureKind, setFailureKind] = useState<SearchFailureKind>(null);
  // Bumped by Retry to re-run the suggest effect for the same query.
  const [retryTick, setRetryTick] = useState(0);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  /** Google placeId → Mesita slug/id after Add to Mesita succeeds. */
  const [addedProfiles, setAddedProfiles] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Overlay pin first-tap stash (Google + overlay-only Mesita) so a later
  // tap can still open after the suggest list is gone. Keyed on pin.id.
  const [heldOverlay, setHeldOverlay] = useState<PlacePrediction | null>(null);
  const [preview, setPreview] = useState<PlacePrediction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const filters = useDiscoveryFilters();
  const scope = useSearchScope();
  const location = scope.locationOptOut ? null : coords;
  // Memoised on the coordinates themselves, not on `location`'s identity:
  // the locate button re-sets coords to a fresh object at the same spot,
  // and that must not re-run the nearby fetch.
  const originLat = location?.lat ?? MONTERREY_CENTER.lat;
  const originLng = location?.lng ?? MONTERREY_CENTER.lng;
  const nearbyOrigin = useMemo(
    () => ({ lat: originLat, lng: originLng }),
    [originLat, originLng],
  );

  const searchInputRef = useRef<TextInput | null>(null);
  const trimmed = query.trim();
  // Idle = map-browse. Closing the name overlay returns the rail even
  // if leftover query text sits in the bar.
  const idle = !searchOpen;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await apiFetchNearbyPlaces(
          supabase,
          nearbyOrigin,
          SEARCH_NEARBY_LIMIT,
        );
        if (!cancelled) {
          setPlaces(rows);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(errMsg(err, "Couldn't load nearby places."));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nearbyOrigin]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Derive the overview-parity fields (rating, open_now, zone, price…) the same
  // way the swipe deck does — the chip filters and rail cards read them — then
  // keep only mappable rows: the rail mirrors the pins one-to-one (web parity).
  // Memoized: enrichPlaceOverview is pure but runs once per row.
  const located = useMemo(
    () =>
      places
        .map((p) => enrichPlaceOverview(p))
        .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'),
    [places],
  );

  // Location (not country) centers the map. Discovery zone stays a Swipe cut.
  const center = location;
  const catalog = useMemo(
    () => withDistances(located, center),
    [located, center],
  );

  const categoryOptions = useMemo(
    () => deriveCategoryOptions(catalog),
    [catalog],
  );

  const visible = useMemo(() => {
    const filtered = applyDiscoveryFilters(catalog, filters);
    // A search pick / pin lands here regardless of the active filters, so keep
    // the selection pinned even when the filters would exclude it — otherwise
    // the black selected pin the user just asked for silently disappears.
    if (selectedId && !filtered.some((p) => p.id === selectedId)) {
      const held = catalog.find((p) => p.id === selectedId);
      if (held) return [held, ...filtered];
    }
    return filtered;
  }, [catalog, filters, selectedId]);

  const searchPins = useMemo(
    () => buildSearchMapPins(predictions, catalog),
    [predictions, catalog],
  );

  useEffect(() => {
    publishFiltersHostContext({
      surface: 'search',
      count: visible.length,
      categoryOptions,
      hasLocation: coords != null,
    });
  }, [visible.length, categoryOptions, coords]);

  const handleUseLocation = () => {
    setLocating(true);
    scope.setLocationOptOut(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 },
    );
  };

  const resetSearchSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

  const openMesitaProfileFromPrediction = useCallback(
    (prediction: PlacePrediction) => {
      resetSearchSession();
      setQuery('');
      setSearchOpen(false);
      const fromAdd = addedProfiles[prediction.placeId];
      if (fromAdd) {
        router.push(`/place/${fromAdd}`);
        return;
      }
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(`/place/${direct}`);
        return;
      }
      const match = matchPredictionToPlace(prediction, catalog);
      if (match) {
        router.push(`/place/${match.slug || match.id}`);
      }
    },
    [addedProfiles, catalog, resetSearchSession, router],
  );

  // Dismisses the name overlay and keeps the typed text so a later
  // bar tap can reopen the same list. Finger-drag and map tap use this.
  const closeNameOverlay = () => {
    setSearchOpen(false);
    searchInputRef.current?.blur();
  };

  // Clear button — wipe the query and close the overlay.
  const closeSearch = () => {
    updateQuery('');
    closeNameOverlay();
  };

  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < 2) {
      if (trimmed.length >= 2) resetSearchSession();
      setPredictions([]);
      setSearching(false);
      setSearchError(null);
      setFailureKind(null);
    } else if (nextTrimmed !== trimmed) {
      setSearching(true);
    }
  };

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    let deepSettled = false;
    const token = sessionTokenRef.current;

    const fastHandle = setTimeout(() => {
      void (async () => {
        try {
          const rows = await apiSuggestPlaces(
            supabase,
            trimmed,
            token,
            center,
            scope.country,
            'fast',
          );
          if (!cancelled && !deepSettled) {
            setPredictions(rows);
            setSearchError(null);
            setFailureKind(null);
          }
        } catch (err) {
          if (!cancelled && !deepSettled) {
            setPredictions([]);
            setSearchError(errMsg(err, 'Search failed — try again.'));
            setFailureKind(classifyFailure(err));
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, FAST_DEBOUNCE_MS);

    const deepHandle = setTimeout(() => {
      void (async () => {
        try {
          const rows = await apiSuggestPlaces(
            supabase,
            trimmed,
            token,
            center,
            scope.country,
            'deep',
          );
          if (!cancelled) {
            deepSettled = true;
            setPredictions(rows);
            setSearchError(null);
            setFailureKind(null);
          }
        } catch {
          // Keep Fast results if Deep fails.
        }
      })();
    }, DEEP_IDLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(fastHandle);
      clearTimeout(deepHandle);
    };
  }, [trimmed, retryTick, center, scope.country]);

  // Retry re-runs the suggest effect for the SAME query (the effect is keyed on
  // retryTick), so the consumer never has to retype after a network blip.
  const retrySearch = useCallback(() => {
    if (trimmed.length < 2) return;
    setSearchError(null);
    setFailureKind(null);
    setSearching(true);
    setRetryTick((t) => t + 1);
  }, [trimmed]);

  // Selects a place on the map (black `#111111` pin + rail card) and returns
  // to the idle map — shared by search picks and tapping a pin directly.
  // Clearing the query is what ends the Places session (updateQuery mints
  // the next token).
  const selectPlace = (id: string) => {
    updateQuery('');
    setSearchOpen(false);
    setRailCollapsed(false);
    setSelectedId(id);
  };

  // On-Mesita row tap → show the place on the map instead of opening detail;
  // the detail is one more tap on the pin or card. The EF-provided Mesita id
  // is the primary join; the exact-name match covers older suggest payloads.
  // Web parity (MESITA-672).
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
      selectPlace(match.id);
      return;
    }
    // On Mesita per the EF but outside the mappable catalog snapshot — no
    // coordinates to pin, so fall back to opening the detail directly.
    updateQuery('');
    setSearchOpen(false);
    resetSearchSession();
    const direct = prediction.mesitaSlug ?? prediction.mesitaId;
    if (direct) router.push(`/place/${direct}`);
  };

  const handlePickGoogle = (prediction: PlacePrediction) => {
    const fromAdd = addedProfiles[prediction.placeId];
    if (fromAdd) {
      resetSearchSession();
      router.push(`/place/${fromAdd}`);
      return;
    }
    if (addStates[prediction.placeId] === 'added') {
      const match =
        catalog.find((p) => p.google_place_id === prediction.placeId) ??
        matchPredictionToPlace(prediction, catalog);
      if (match) {
        resetSearchSession();
        router.push(`/place/${match.slug || match.id}`);
        return;
      }
    }
    if (predictionOnMesita(prediction)) {
      openMesitaProfileFromPrediction(prediction);
      return;
    }
    setPreview(prediction);
    setPreviewOpen(true);
    resetSearchSession();
  };

  const openCatalogPlace = (place: Place) => {
    const google = googlePredictionFromPlace(place);
    if (google) {
      handlePickGoogle(google);
      return;
    }
    router.push(`/place/${place.slug || place.id}`);
  };

  const selectCatalogPlace = (place: Place) => {
    setHeldOverlay(googlePredictionFromPlace(place));
    selectPlace(place.id);
  };

  const handleSelectPin = (pin: SearchMapPin) => {
    const prediction =
      predictions.find(
        (p) => p.mesitaId === pin.id || p.placeId === pin.id,
      ) ??
      (heldOverlay &&
      (heldOverlay.placeId === pin.id || heldOverlay.mesitaId === pin.id)
        ? heldOverlay
        : null);
    const place = catalog.find((p) => p.id === pin.id);
    const action = overlayPinDecision({
      selectedId,
      pinId: pin.id,
      googleOnly: prediction ? !predictionOnMesita(prediction) : false,
      inCatalog: Boolean(place),
      hasOverlay: Boolean(prediction),
    });
    switch (action) {
      case 'open-google':
        if (prediction) handlePickGoogle(prediction);
        return;
      case 'open-catalog':
        if (place) openCatalogPlace(place);
        return;
      case 'open-mesita-slug':
        if (prediction) handlePickMesita(prediction);
        return;
      case 'select-google':
      case 'select-mesita-overlay':
        if (prediction) setHeldOverlay(prediction);
        setRailCollapsed(false);
        setSelectedId(pin.id);
        return;
      case 'select-mesita-catalog':
        setHeldOverlay(null);
        if (prediction) {
          handlePickMesita(prediction);
          return;
        }
        if (place) selectCatalogPlace(place);
        return;
      case 'noop':
        return;
    }
  };

  const handleAdd = (prediction: PlacePrediction) => {
    if (addStates[prediction.placeId]) return;
    setAddStates((s) => ({ ...s, [prediction.placeId]: 'adding' }));
    void (async () => {
      try {
        const created = await apiCreateProject(supabase, {
          placeId: prediction.placeId,
        });
        const dest = created.place.slug || created.place.id;
        setAddStates((s) => ({ ...s, [prediction.placeId]: 'added' }));
        if (dest) {
          setAddedProfiles((s) => ({
            ...s,
            [prediction.placeId]: dest,
          }));
          router.push(`/place/${dest}`);
        }
      } catch (err) {
        setAddStates((s) => {
          const next = { ...s };
          delete next[prediction.placeId];
          return next;
        });
        setSearchError(errMsg(err, "Couldn't add that place right now."));
      }
    })();
  };

  // The rail's "No places match" escape resets the SHARED filter store — the
  // same reset the sheet's Reset button runs (MESITA-646).
  const clearFilters = () => {
    resetDiscoveryFilters();
  };

  const selectedPlace = selectedId
    ? catalog.find((p) => p.id === selectedId)
    : null;

  const showResults = searchOpen;

  return (
    <View className="flex-1 bg-background">
      <View className="absolute inset-0">
        <SearchMap
          places={visible}
          selectedId={selectedId}
          userLocation={coords}
          center={center}
          apiKey={GMP_KEY}
          pins={searchPins}
          onSelectPlace={selectCatalogPlace}
          onOpenPlace={openCatalogPlace}
          onSelectPin={handleSelectPin}
          onMapPress={() => {
            if (searchOpen) closeNameOverlay();
          }}
          onMapDrag={() => {
            if (searchOpen) closeNameOverlay();
          }}
        />
      </View>

      <SearchBar
        query={query}
        top={insets.top + 8}
        countryCode={scope.country}
        locationSet={location != null}
        onChangeQuery={updateQuery}
        onFocus={() => setSearchOpen(true)}
        onClear={closeSearch}
        onOpenScope={() => setScopeOpen(true)}
        inputRef={searchInputRef}
      />

      {/* Results: height fits content; max ~70% so the map stays visible */}
      {showResults ? (
        <View
          className="absolute inset-x-0 z-20 overflow-hidden rounded-b-2xl border-b border-border bg-card"
          style={{
            top: insets.top + 60,
            maxHeight: '70%',
            ...SHADOW_ELEV,
          }}
        >
          {trimmed.length === 0 ? (
            <EmptySearchPrompt />
          ) : (
            <SearchResultsPanel
              query={trimmed}
              searching={searching}
              searchError={searchError}
              failureKind={failureKind}
              predictions={predictions}
              addStates={addStates}
              onPickMesita={handlePickMesita}
              onPickGoogle={handlePickGoogle}
              onRetry={retrySearch}
            />
          )}
        </View>
      ) : null}

      <IdleCatalogRail
        idle={idle}
        collapsed={railCollapsed}
        loading={catalogLoading}
        fetchError={fetchError}
        places={visible}
        selectedId={selectedId}
        catalogCount={catalog.length}
        bottomInset={insets.bottom}
        onCollapse={() => setRailCollapsed(true)}
        onExpand={() => setRailCollapsed(false)}
        onClearFilters={clearFilters}
        onSelectPlace={setSelectedId}
        onOpenPlace={(id) => {
          const place = catalog.find((p) => p.id === id);
          if (place) openCatalogPlace(place);
          else router.push(`/place/${id}`);
        }}
      />

      {/* Selected chip when rail collapsed */}
      {selectedPlace && railCollapsed ? (
        <Pressable
          onPress={() => openCatalogPlace(selectedPlace)}
          className="absolute z-20 mx-4 rounded-2xl border border-border bg-card px-4 py-3"
          style={{
            bottom: Math.max(insets.bottom, 8) + 52,
            left: 0,
            right: 0,
            ...SHADOW_ELEV,
          }}
        >
          <Text className="font-semibold text-foreground" numberOfLines={1}>
            {selectedPlace.name}
          </Text>
          <Text className="text-xs text-muted-foreground">Tap to open</Text>
        </Pressable>
      ) : null}

      <SearchScopeSheet
        open={scopeOpen}
        country={scope.country}
        locationSet={location != null}
        locating={locating}
        onCountry={scope.setCountry}
        onUseLocation={handleUseLocation}
        onClearLocation={() => scope.setLocationOptOut(true)}
        onClose={() => setScopeOpen(false)}
      />

      <GooglePlaceSheet
        open={previewOpen}
        prediction={preview}
        addState={preview ? addStates[preview.placeId] : undefined}
        apiKey={GMP_KEY}
        onAdd={handleAdd}
        onClose={() => setPreviewOpen(false)}
      />
    </View>
  );
}
