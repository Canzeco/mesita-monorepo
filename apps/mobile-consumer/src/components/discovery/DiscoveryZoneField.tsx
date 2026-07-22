// Where-module location search (MESITA-672): type any place or area → pick →
// resolve to a CENTER the distance filter rings. RN port of web
// discovery-zone-field.tsx. Autocomplete rides the shared EF
// (consumer-web-suggest-places, session-tokened); only the chosen prediction is
// geocoded to lat/lng — client-side via zone-geocode (Google Places details,
// the GooglePlaceSheet precedent). "Current location" clears back to the device
// fix. Self-contained so BOTH hosts (Swipe + Search) get the same field with no
// extra wiring.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LocateFixed, MapPin, Search, X } from "lucide-react-native";

import { GRADIENT_DIAGONAL, GRADIENTS } from "@/constants/brand";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/place-search";
import type { DiscoveryZone } from "@/lib/discovery-filters-engine";
import { newSessionToken } from "@/lib/search-utils";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { setDiscoveryZone } from "@/lib/use-discovery-filters";
import { errMsg } from "@/lib/utils";
import { resolveZoneFromPlaceId } from "@/lib/zone-geocode";
import { Pill } from "./filter-controls";

const SUGGEST_DEBOUNCE_MS = 300;
// Public Google key the map already runs on (SearchClient reads the same var),
// available client-side on BOTH the Search and Swipe surfaces.
const GMP_KEY = process.env.EXPO_PUBLIC_GMP_KEY ?? "";

const MUTED_FG = "#775254";
const PRIMARY = "#fb2b7b";

export function DiscoveryZoneField({
  zone,
  hasLocation,
}: {
  /** Active searched center, or null = current location / here. */
  zone: DiscoveryZone | null;
  /** Device geolocation granted — enables the "distance from me" default. */
  hasLocation: boolean;
}) {
  const sessionTokenRef = useRef(newSessionToken());
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const trimmed = query.trim();

  // Synchronous resets live in the change handler (the set-state-in-effect lint
  // rule bars them from the effect below); the effect only owns the debounced
  // async fetch.
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
      // Clear the field + end the Places session (fresh token next search).
      setQuery("");
      setPredictions([]);
      sessionTokenRef.current = newSessionToken();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't locate that place — try again."));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Pill
          active={zone === null}
          onPress={() => setDiscoveryZone(null)}
          icon={
            <LocateFixed color={zone === null ? "#ffffff" : MUTED_FG} size={14} />
          }
        >
          Current location
        </Pill>
        {zone ? (
          <View style={{ borderRadius: 999, overflow: "hidden" }}>
            <LinearGradient
              colors={GRADIENTS.pink}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
            >
              <View className="min-h-11 flex-row items-center gap-1.5 py-1 pl-4 pr-2">
                <MapPin color="#ffffff" size={14} />
                <Text
                  numberOfLines={1}
                  className="font-medium text-white"
                  style={{ fontSize: 13, maxWidth: 180 }}
                >
                  {zone.label}
                </Text>
                <Pressable
                  onPress={() => setDiscoveryZone(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear location"
                  hitSlop={8}
                  className="h-6 w-6 items-center justify-center rounded-full active:bg-white/20"
                >
                  <X color="#ffffff" size={14} />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        ) : null}
      </View>

      {!hasLocation && zone === null ? (
        <Text className="text-muted-foreground/70" style={{ fontSize: 11 }}>
          Turn on location to rank by distance, or search a place below.
        </Text>
      ) : null}

      <View className="flex-row items-center gap-2 rounded-full bg-muted px-3">
        <Search color={MUTED_FG} size={16} />
        <TextInput
          value={query}
          onChangeText={updateQuery}
          placeholder="Search a city, zone or address…"
          placeholderTextColor="#77525466"
          inputMode="search"
          autoCorrect={false}
          returnKeyType="search"
          className="min-w-0 flex-1 text-foreground"
          style={{ height: 44, fontSize: 13 }}
        />
        {searching ? (
          <ActivityIndicator color={PRIMARY} size="small" />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => updateQuery("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            className="h-6 w-6 items-center justify-center"
          >
            <X color={MUTED_FG} size={16} />
          </Pressable>
        ) : null}
      </View>

      {trimmed.length >= 2 ? (
        <View className="overflow-hidden rounded-2xl border border-border">
          {predictions.length === 0 && !searching ? (
            <Text
              className="px-3 py-3 text-muted-foreground"
              style={{ fontSize: 13 }}
            >
              No matches.
            </Text>
          ) : (
            predictions.map((prediction, i) => (
              <Pressable
                key={prediction.placeId}
                onPress={() => pick(prediction)}
                disabled={resolvingId !== null}
                accessibilityRole="button"
                accessibilityLabel={prediction.mainText}
                className={`flex-row items-center gap-2.5 px-3 py-2.5 active:bg-muted/50 ${
                  i > 0 ? "border-t border-border/50" : ""
                } ${resolvingId !== null ? "opacity-60" : ""}`}
              >
                <MapPin color={MUTED_FG} size={16} />
                <View className="min-w-0 flex-1">
                  <Text
                    numberOfLines={1}
                    className="font-medium text-foreground"
                    style={{ fontSize: 13 }}
                  >
                    {prediction.mainText}
                  </Text>
                  {prediction.secondaryText ? (
                    <Text
                      numberOfLines={1}
                      className="text-muted-foreground"
                      style={{ fontSize: 11 }}
                    >
                      {prediction.secondaryText}
                    </Text>
                  ) : null}
                </View>
                {resolvingId === prediction.placeId ? (
                  <ActivityIndicator color={PRIMARY} size="small" />
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
