import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronUp,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GooglePlaceSheet } from '@/components/search/GooglePlaceSheet';
import { SearchMap } from '@/components/search/SearchMap';
import { SearchResultsPanel } from '@/components/search/SearchResultsPanel';
import type { AddState } from '@/components/memo/types';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import {
  apiCreateProject,
  apiSuggestPlaces,
  type PlacePrediction,
} from '@/lib/api/place-search';
import { apiFetchPublicPlaces, type Place } from '@/lib/api/places';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { newSessionToken, withDistances } from '@/lib/search-utils';
import { supabase } from '@/lib/supabase';
import {
  errMsg,
  firstInitial,
  formatKm,
  formatRating,
} from '@/lib/utils';

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

      {/* Floating search bar */}
      <View
        className="absolute inset-x-0 z-30 px-3"
        style={{ top: insets.top + 8 }}
      >
        <View
          className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5"
          style={SHADOW_ELEV}
        >
          <SearchIcon color="#775254" size={18} />
          <TextInput
            value={query}
            onChangeText={updateQuery}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search places"
            placeholderTextColor="#77525466"
            className="min-w-0 flex-1 text-[15px] text-foreground"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                updateQuery('');
                setSearchOpen(false);
              }}
              hitSlop={8}
            >
              <X color="#775254" size={18} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => undefined}
              hitSlop={8}
              accessibilityLabel="Filters coming soon"
            >
              <SlidersHorizontal color="#77525466" size={18} />
            </Pressable>
          )}
        </View>
      </View>

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
    </View>
  );
}

function RailCard({
  place,
  selected,
  onPress,
}: {
  place: Place;
  selected: boolean;
  onPress: () => void;
}) {
  const photo = place.photos[0];
  const rating = formatRating(place.google_rating);
  const price = formatPlacePriceLevelSymbols(place.price_level);
  const opening = getOpeningStatusLabel(place);
  const distance =
    place.distance_km != null && place.distance_km > 0
      ? formatKm(place.distance_km)
      : null;

  return (
    <Pressable
      onPress={onPress}
      className={`w-56 overflow-hidden rounded-2xl border bg-card ${
        selected ? 'border-primary' : 'border-border'
      }`}
      style={SHADOW_ELEV}
    >
      <View className="h-28 bg-muted">
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text className="font-display text-2xl font-bold text-white/85">
              {firstInitial(place.name)}
            </Text>
          </LinearGradient>
        )}
      </View>
      <View className="gap-0.5 p-2.5">
        <Text
          className="font-display text-[14px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          {rating ? (
            <View className="flex-row items-center gap-0.5">
              <Star color="#f59e0b" fill="#f59e0b" size={11} />
              <Text className="text-[11px] font-medium text-foreground">
                {rating}
              </Text>
            </View>
          ) : null}
          {price ? (
            <Text className="text-[11px] text-muted-foreground">{price}</Text>
          ) : null}
          {distance ? (
            <Text className="text-[11px] text-muted-foreground">{distance}</Text>
          ) : null}
        </View>
        {opening ? (
          <Text
            className={`text-[10px] ${
              place.open_now === true
                ? 'text-emerald-600'
                : 'text-muted-foreground'
            }`}
            numberOfLines={1}
          >
            {opening}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
