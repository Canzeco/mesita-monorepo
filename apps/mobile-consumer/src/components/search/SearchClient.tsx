import { useRouter } from 'expo-router';
import {
  ChevronUp,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GooglePlaceSheet } from '@/components/search/GooglePlaceSheet';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchMap } from '@/components/search/SearchMap';
import { RailCard } from '@/components/search/SearchRailCard';
import { SearchResultsPanel } from '@/components/search/SearchResultsPanel';
import type { AddState } from '@/components/memo/types';
import { FiltersComingSoonSheet } from '@/components/ui/FiltersComingSoon';
import { SHADOW_ELEV } from '@/constants/brand';
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from '@/lib/api/place-search';
import { apiFetchPublicPlaces, type Place } from '@/lib/api/places';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { newSessionToken, withDistances } from '@/lib/search-utils';
import { supabase } from '@/lib/supabase';
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

  const catalog = useMemo(
    () => withDistances(places, coords),
    [places, coords],
  );

  const visible = useMemo(() => {
    if (selectedId && !catalog.some((p) => p.id === selectedId)) {
      return catalog;
    }
    return catalog;
  }, [catalog, selectedId]);

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
      router.push(`/place/${match.id}`);
      return;
    }
    if (id) router.push(`/place/${id}`);
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

  const showResults = searchOpen || trimmed.length >= 2;

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
            <View className="items-center px-6 py-10">
              <Text className="font-display text-xl font-semibold text-foreground">
                Where to today?
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Search Mesita partners and Google places.
              </Text>
            </View>
          ) : (
            <SearchResultsPanel
              query={trimmed}
              searching={searching}
              searchError={searchError}
              predictions={predictions}
              addStates={addStates}
              onPickMesita={handlePickMesita}
              onPickGoogle={handlePickGoogle}
            />
          )}
        </View>
      ) : null}

      {/* Idle catalog rail */}
      {idle && !railCollapsed ? (
        <View
          className="absolute inset-x-0 z-20"
          style={{ bottom: Math.max(insets.bottom, 8) + 4 }}
        >
          <View className="mb-2 flex-row items-center justify-between px-4">
            <Text className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Nearby
            </Text>
            <Pressable
              onPress={() => setRailCollapsed(true)}
              className="flex-row items-center gap-1 rounded-full bg-card/90 px-2.5 py-1"
            >
              <X color="#775254" size={14} />
              <Text className="text-[11px] font-medium text-muted-foreground">
                {catalogLoading ? '…' : `${visible.length}`}
              </Text>
            </Pressable>
          </View>
          {catalogLoading ? (
            <View className="h-28 items-center justify-center">
              <ActivityIndicator color="#fb2b7b" />
            </View>
          ) : fetchError ? (
            <View className="mx-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <Text className="text-xs text-rose-700">{fetchError}</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={visible}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
              renderItem={({ item }) => (
                <RailCard
                  place={item}
                  selected={item.id === selectedId}
                  onPress={() => {
                    if (selectedId === item.id) {
                      router.push(`/place/${item.id}`);
                    } else {
                      setSelectedId(item.id);
                    }
                  }}
                />
              )}
            />
          )}
        </View>
      ) : null}

      {idle && railCollapsed ? (
        <View
          className="absolute inset-x-0 z-20 items-center"
          style={{ bottom: Math.max(insets.bottom, 8) + 8 }}
        >
          <Pressable
            onPress={() => setRailCollapsed(false)}
            className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2"
            style={SHADOW_ELEV}
          >
            <ChevronUp color="#fb2b7b" size={16} />
            <Text className="text-xs font-semibold text-foreground">
              Show places
            </Text>
          </Pressable>
        </View>
      ) : null}

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
      <FiltersComingSoonSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}
