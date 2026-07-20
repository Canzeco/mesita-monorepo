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
import { SearchResultsPanel } from '@/components/search/SearchResultsPanel';
import type { AddState } from '@/components/memo/types';
import { SHADOW_ELEV } from '@/constants/brand';
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from '@/lib/api/place-search';
import { apiFetchPublicPlaces, type Place } from '@/lib/api/places';
import { placePath } from '@/lib/consumer-route-contract';
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
} from '@/lib/discovery-filters-engine';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { newSessionToken, withDistances } from '@/lib/search-utils';
import { supabase } from '@/lib/supabase';
import { useDiscoveryFilters } from '@/lib/use-discovery-filters';
import { errMsg } from '@/lib/utils';

const SUGGEST_DEBOUNCE_MS = 300;
const GMP_KEY = process.env.EXPO_PUBLIC_GMP_KEY ?? '';

type Coords = { lat: number; lng: number };

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
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlacePrediction | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  // Distances ride on the chosen zone center or the device fix; filters then
  // facet the SAME array the map pins and rail render (web SearchClient parity).
  const catalog = useMemo(
    () => withDistances(places, filters.zone ?? coords),
    [places, filters.zone, coords],
  );
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(catalog),
    [catalog],
  );

  const visible = useMemo(() => {
    const filtered = applyDiscoveryFilters(catalog, filters);
    if (selectedId && !filtered.some((p) => p.id === selectedId)) {
      const held = catalog.find((p) => p.id === selectedId);
      if (held) return [held, ...filtered];
    }
    return filtered;
  }, [catalog, filters, selectedId]);

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
          }
        } catch (err) {
          if (!cancelled) {
            setPredictions([]);
            setSearchError(errMsg(err, 'Search failed — try again.'));
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
  }, [trimmed]);

  const handlePickMesita = (prediction: PlacePrediction) => {
    const id = prediction.mesitaId ?? prediction.mesitaSlug;
    const match =
      (prediction.mesitaId
        ? catalog.find((p) => p.id === prediction.mesitaId)
        : null) ?? matchPredictionToPlace(prediction, catalog);
    updateQuery('');
    setSearchOpen(false);
    resetSearchSession();
    if (match) {
      setSelectedId(match.id);
      setRailCollapsed(false);
      // No interactive map selection on web/placeholder — open detail.
      router.push(placePath(match.id));
      return;
    }
    if (id) router.push(placePath(id));
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

  const selectedPlace = selectedId
    ? catalog.find((p) => p.id === selectedId)
    : null;

  return (
    <View className="flex-1 bg-background">
      <View className="absolute inset-0">
        <SearchMap
          places={visible}
          selectedId={selectedId}
          userLocation={coords}
          apiKey={GMP_KEY}
          onSelect={(id) => {
            setSelectedId(id);
            setRailCollapsed(false);
            setSearchOpen(false);
            updateQuery('');
          }}
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

      {/* Typing: height fits result count; max-h 70% so the map stays visible.
          Focused-but-empty uses a separate fixed ~70% prompt (web parity). */}
      {trimmed.length > 0 ? (
        <View
          className="absolute inset-x-0 z-20 overflow-hidden rounded-b-3xl border-b border-border bg-background"
          style={{
            top: insets.top + 60,
            maxHeight: '70%',
            ...SHADOW_ELEV,
          }}
        >
          <SearchResultsPanel
            query={trimmed}
            searching={searching}
            searchError={searchError}
            predictions={predictions}
            addStates={addStates}
            onPickMesita={handlePickMesita}
            onPickGoogle={handlePickGoogle}
          />
        </View>
      ) : null}

      {searchOpen && trimmed.length === 0 ? <EmptySearchPrompt /> : null}

      <IdleCatalogRail
        idle={idle}
        collapsed={railCollapsed}
        loading={catalogLoading}
        fetchError={fetchError}
        places={visible}
        selectedId={selectedId}
        bottomInset={insets.bottom}
        onCollapse={() => setRailCollapsed(true)}
        onExpand={() => setRailCollapsed(false)}
        onSelectPlace={setSelectedId}
        onOpenPlace={(id) => router.push(placePath(id))}
      />

      {/* Selected chip when rail collapsed */}
      {selectedPlace && railCollapsed ? (
        <Pressable
          onPress={() => router.push(placePath(selectedPlace.id))}
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
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        ariaLabel="Search filters"
        categoryOptions={categoryOptions}
        count={visible.length}
        hasLocation={coords != null}
      />
    </View>
  );
}
