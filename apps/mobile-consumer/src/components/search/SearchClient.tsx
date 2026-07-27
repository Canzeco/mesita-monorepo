import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSheet } from '@/components/discovery/FilterSheet';
import { GooglePlaceSheet } from '@/components/search/GooglePlaceSheet';
import { SearchBar } from '@/components/search/SearchBar';
import {
  EmptySearchPrompt,
  IdleCatalogRail,
} from '@/components/search/SearchCatalogRail';
import { SearchMap } from '@/components/search/SearchMap';
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
import { apiFetchPublicPlaces, type Place } from '@/lib/api/places';
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
} from '@/lib/discovery-filters-engine';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { enrichPlaceOverview } from '@/lib/place-overview';
import { newSessionToken, withDistances } from '@/lib/search-utils';
import { supabase } from '@/lib/supabase';
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';
import { errMsg } from '@/lib/utils';

const SUGGEST_DEBOUNCE_MS = 300;
const GMP_KEY = process.env.EXPO_PUBLIC_GMP_KEY ?? '';

type Coords = { lat: number; lng: number };

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlacePrediction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Shared discovery filters (MESITA-646/672): pins + rail narrow LIVE off the
  // ONE global store — Swipe shows the exact same state — and the red tune dot
  // lights on any deviation from defaults.
  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);

  const trimmed = query.trim();
  const idle = trimmed.length === 0 && !searchOpen;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await apiFetchPublicPlaces(supabase, 200);
        if (!cancelled) {
          setPlaces(rows);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(errMsg(err, "Couldn't load places."));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Distances ride on the searched zone center when set, else the device's live
  // location; the discovery filters then facet the SAME array the pins + rail
  // render.
  const center = filters.zone ?? coords;
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
    // the red pin the user just asked for silently disappears.
    if (selectedId && !filtered.some((p) => p.id === selectedId)) {
      const held = catalog.find((p) => p.id === selectedId);
      if (held) return [held, ...filtered];
    }
    return filtered;
  }, [catalog, filters, selectedId]);

  const hasLocation = filters.zone != null || coords != null;

  const resetSearchSession = useCallback(() => {
    sessionTokenRef.current = newSessionToken();
  }, []);

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
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const rows = await apiSuggestPlaces(
            supabase,
            trimmed,
            sessionTokenRef.current,
          );
          if (!cancelled) {
            setPredictions(rows);
            setSearchError(null);
            setFailureKind(null);
          }
        } catch (err) {
          if (!cancelled) {
            setPredictions([]);
            setSearchError(errMsg(err, 'Search failed — try again.'));
            setFailureKind(classifyFailure(err));
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, retryTick]);

  // Retry re-runs the suggest effect for the SAME query (the effect is keyed on
  // retryTick), so the consumer never has to retype after a network blip.
  const retrySearch = useCallback(() => {
    if (trimmed.length < 2) return;
    setSearchError(null);
    setFailureKind(null);
    setSearching(true);
    setRetryTick((t) => t + 1);
  }, [trimmed]);

  // On-Mesita row tap → show the place on the map (red selected pin + rail
  // card) instead of opening detail; the detail is one more tap on the pin or
  // card. The EF-provided Mesita id is the primary join; the exact-name match
  // covers older suggest payloads. Web parity (MESITA-672).
  const handlePickMesita = (prediction: PlacePrediction) => {
    const match =
      (prediction.mesitaId
        ? catalog.find((p) => p.id === prediction.mesitaId)
        : null) ?? matchPredictionToPlace(prediction, catalog);
    if (match) {
      // Clearing the query is the selection that ends the Places session
      // (updateQuery mints the next token) and hands back the idle map.
      updateQuery('');
      setSearchOpen(false);
      setRailCollapsed(false);
      setSelectedId(match.id);
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
    setPreview(prediction);
    setPreviewOpen(true);
    resetSearchSession();
  };

  const handleAdd = (prediction: PlacePrediction) => {
    if (addStates[prediction.placeId]) return;
    setAddStates((s) => ({ ...s, [prediction.placeId]: 'adding' }));
    void (async () => {
      try {
        await apiCreateProject(supabase, { placeId: prediction.placeId });
        setAddStates((s) => ({ ...s, [prediction.placeId]: 'added' }));
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

  const showResults = searchOpen || trimmed.length >= 2;

  return (
    <View className="flex-1 bg-background">
      <View className="absolute inset-0">
        <SearchMap
          places={visible}
          selectedId={selectedId}
          userLocation={coords}
          center={center}
          apiKey={GMP_KEY}
          onSelectPlace={(place) => {
            setSelectedId(place.id);
            setRailCollapsed(false);
            setSearchOpen(false);
            updateQuery('');
          }}
          onOpenPlace={(place) => router.push(`/place/${place.id}`)}
          onMapPress={() => {
            if (searchOpen) {
              setSearchOpen(false);
              updateQuery('');
            }
          }}
        />
      </View>

      <SearchBar
        query={query}
        top={insets.top + 8}
        filtersActive={filtersActive}
        onChangeQuery={updateQuery}
        onFocus={() => setSearchOpen(true)}
        onClear={() => {
          updateQuery('');
          setSearchOpen(false);
        }}
        onOpenFilters={() => setFiltersOpen(true)}
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
        onOpenPlace={(id) => router.push(`/place/${id}`)}
      />

      {/* Selected chip when rail collapsed */}
      {selectedPlace && railCollapsed ? (
        <Pressable
          onPress={() => router.push(`/place/${selectedPlace.id}`)}
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

      <GooglePlaceSheet
        open={previewOpen}
        prediction={preview}
        addState={preview ? addStates[preview.placeId] : undefined}
        apiKey={GMP_KEY}
        onAdd={handleAdd}
        onClose={() => setPreviewOpen(false)}
      />
      {/* Shared five-parameter discovery sheet (Where · Distance · When · What
          · Randomness). Pins + rail narrow live off the same store; the sheet
          reads/writes it itself — the host only supplies the catalog-derived
          category options, the live post-filter count, and whether a location
          center exists. */}
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categoryOptions={categoryOptions}
        count={visible.length}
        hasLocation={hasLocation}
      />
    </View>
  );
}
