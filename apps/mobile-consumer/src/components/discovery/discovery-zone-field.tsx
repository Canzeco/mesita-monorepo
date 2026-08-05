// Where-module location search (MESITA-672, unified field MESITA-905): one
// control — search + in-field locate. RN port of web discovery-zone-field.

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
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
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
  const locateActive = zone === null;

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

  const clearZone = () => {
    setDiscoveryZone(null);
    setQuery('');
    setPredictions([]);
  };

  return (
    <View className="gap-2">
      <View className="h-11 flex-row items-center rounded-full bg-muted/60 pl-3 pr-1">
        <Search color={COLORS.mutedForeground} size={16} />
        {zone ? (
          <View className="ml-2 min-w-0 flex-1 flex-row items-center overflow-hidden rounded-full">
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 4,
                paddingLeft: 12,
                paddingRight: 6,
                borderRadius: 999,
              }}
            >
              <MapPin color="#fff" size={14} />
              <Text
                className="min-w-0 flex-1 text-[13px] font-medium text-white"
                numberOfLines={1}
              >
                {zone.label}
              </Text>
              <Pressable
                onPress={clearZone}
                accessibilityLabel="Clear location"
                hitSlop={8}
                className="h-6 w-6 items-center justify-center rounded-full"
              >
                <X color="#fff" size={14} />
              </Pressable>
            </LinearGradient>
          </View>
        ) : (
          <TextInput
            value={query}
            onChangeText={updateQuery}
            placeholder="Search a city, zone or address…"
            placeholderTextColor="#77525466"
            className="min-w-0 flex-1 px-2 text-[13px] text-foreground"
            autoCorrect={false}
            returnKeyType="search"
          />
        )}
        {searching || (!zone && query.length > 0) ? (
          <View className="mr-1">
            {searching ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Pressable
                onPress={() => updateQuery('')}
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <X color={COLORS.mutedForeground} size={16} />
              </Pressable>
            )}
          </View>
        ) : null}
        <Pressable
          onPress={clearZone}
          accessibilityLabel="Use current location"
          accessibilityState={{ selected: locateActive }}
          className="h-9 w-9 items-center justify-center overflow-hidden rounded-full"
        >
          {locateActive ? (
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LocateFixed color="#fff" size={16} />
            </LinearGradient>
          ) : (
            <LocateFixed color={COLORS.mutedForeground} size={16} />
          )}
        </Pressable>
      </View>

      {!hasLocation && zone === null ? (
        <Text className="text-[11px] text-muted-foreground/70">
          Turn on location to rank by distance, or search a place above.
        </Text>
      ) : null}

      {!zone && trimmed.length >= 2 ? (
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
                <MapPin color={COLORS.mutedForeground} size={16} />
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
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
