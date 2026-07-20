// Where-module location search (MESITA-672): type any place or area → pick →
// resolve to a CENTER the distance filter rings. RN port of web
// discovery-zone-field.tsx.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LocateFixed, MapPin, Search, X } from 'lucide-react-native';

import {
  Pill,
  PillText,
} from '@/components/discovery/discovery-filter-controls';
import { apiSuggestPlaces, type PlacePrediction } from '@/lib/api/place-search';
import type { DiscoveryZone } from '@/lib/discovery-filters-engine';
import { newSessionToken } from '@/lib/search-utils';
import { setDiscoveryZone } from '@/lib/use-discovery-filters';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { errMsg } from '@/lib/utils';
import { resolveZoneFromPlaceId } from '@/lib/zone-geocode';

const SUGGEST_DEBOUNCE_MS = 300;
const GMP_KEY = process.env.EXPO_PUBLIC_GMP_KEY ?? '';

export function DiscoveryZoneField({
  zone,
  hasLocation,
}: {
  zone: DiscoveryZone | null;
  hasLocation: boolean;
}) {
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const trimmed = query.trim();

  const updateQuery = (next: string) => {
    setQuery(next);
    const nextTrimmed = next.trim();
    if (nextTrimmed.length < 2) {
      setPredictions([]);
      setSearching(false);
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
          if (!cancelled) setPredictions(rows);
        } catch {
          if (!cancelled) setPredictions([]);
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

  const pick = async (prediction: PlacePrediction) => {
    if (resolvingId) return;
    setResolvingId(prediction.placeId);
    try {
      const resolved = await resolveZoneFromPlaceId(
        prediction.placeId,
        GMP_KEY,
        prediction.mainText,
      );
      if (!resolved) {
        toast.error("Couldn't locate that place — try another.");
        return;
      }
      setDiscoveryZone(resolved);
      setQuery('');
      setPredictions([]);
      sessionTokenRef.current = newSessionToken();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't locate that place — try again."));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-1.5">
        <Pill active={zone === null} onClick={() => setDiscoveryZone(null)}>
          <LocateFixed color={zone === null ? '#fff' : '#775254'} size={14} />
          <PillText active={zone === null}>Current location</PillText>
        </Pill>
        {zone ? (
          <View className="min-h-11 flex-row items-center gap-1.5 overflow-hidden rounded-full bg-primary py-1 pl-4 pr-2">
            <MapPin color="#fff" size={14} />
            <Text
              className="max-w-[180px] text-[13px] font-medium text-white"
              numberOfLines={1}
            >
              {zone.label}
            </Text>
            <Pressable
              onPress={() => setDiscoveryZone(null)}
              accessibilityLabel="Clear location"
              hitSlop={8}
              className="h-6 w-6 items-center justify-center rounded-full"
            >
              <X color="#fff" size={14} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {!hasLocation && zone === null ? (
        <Text className="text-[11px] text-muted-foreground/70">
          Turn on location to rank by distance, or search a place below.
        </Text>
      ) : null}

      <View className="relative justify-center">
        <View
          pointerEvents="none"
          className="absolute left-3 z-10"
          style={{ top: 14 }}
        >
          <Search color="#775254" size={16} />
        </View>
        <TextInput
          value={query}
          onChangeText={updateQuery}
          placeholder="Search a city, zone or address…"
          placeholderTextColor="#77525466"
          className="h-11 w-full rounded-full bg-muted/60 pl-9 pr-9 text-[13px] text-foreground"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching || query.length > 0 ? (
          <View className="absolute right-3" style={{ top: 12 }}>
            {searching ? (
              <ActivityIndicator color="#fb2b7b" size="small" />
            ) : (
              <Pressable
                onPress={() => updateQuery('')}
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <X color="#775254" size={16} />
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {trimmed.length >= 2 ? (
        <ScrollView
          className="max-h-56 rounded-2xl border border-border/60"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {predictions.length === 0 && !searching ? (
            <Text className="px-3 py-3 text-[13px] text-muted-foreground">
              No matches.
            </Text>
          ) : (
            predictions.map((prediction) => (
              <Pressable
                key={prediction.placeId}
                onPress={() => void pick(prediction)}
                disabled={resolvingId !== null}
                className={`flex-row items-center gap-2.5 border-b border-border/50 px-3 py-2.5 active:bg-muted/50 ${
                  resolvingId !== null ? 'opacity-60' : ''
                }`}
              >
                <MapPin color="#775254" size={16} />
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-[13px] font-medium text-foreground"
                    numberOfLines={1}
                  >
                    {prediction.mainText}
                  </Text>
                  {prediction.secondaryText ? (
                    <Text
                      className="text-[11px] text-muted-foreground"
                      numberOfLines={1}
                    >
                      {prediction.secondaryText}
                    </Text>
                  ) : null}
                </View>
                {resolvingId === prediction.placeId ? (
                  <ActivityIndicator color="#fb2b7b" size="small" />
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
