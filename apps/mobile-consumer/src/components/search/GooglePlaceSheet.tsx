import { LinearGradient } from 'expo-linear-gradient';
import { Wand2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AddState } from '@/components/memo/types';
import { GooglePlacePreview } from '@/components/search/google-place-preview';
import {
  COLORS,
  GRADIENT_DIAGONAL,
  GRADIENTS,
  SHADOW_GLOW,
} from '@/constants/brand';
import type { PlacePrediction } from '@/lib/api/place-search';

type GoogleProfile = {
  photoUrl?: string;
  formattedAddress?: string;
  googleMapsUri?: string;
};

const profileCache = new Map<string, GoogleProfile>();

async function fetchGoogleProfile(
  placeId: string,
  apiKey: string,
): Promise<GoogleProfile> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
      `?fields=photos,formattedAddress,googleMapsUri&key=${apiKey}`,
  );
  if (!res.ok) throw new Error(`places details ${res.status}`);
  const data = (await res.json()) as {
    photos?: { name: string }[];
    formattedAddress?: string;
    googleMapsUri?: string;
  };
  const photoName = data.photos?.[0]?.name;
  return {
    photoUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${apiKey}`
      : undefined,
    formattedAddress: data.formattedAddress,
    googleMapsUri: data.googleMapsUri,
  };
}

export function GooglePlaceSheet({
  open,
  prediction,
  addState,
  apiKey,
  onAdd,
  onClose,
}: {
  open: boolean;
  prediction: PlacePrediction | null;
  addState: AddState | undefined;
  apiKey: string;
  onAdd: (prediction: PlacePrediction) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const adding = addState === 'adding';
  const added = addState === 'added';
  const [, setFetchedId] = useState<string | null>(null);
  const profile = prediction ? profileCache.get(prediction.placeId) : undefined;

  useEffect(() => {
    if (!open || !prediction || !apiKey) return;
    const id = prediction.placeId;
    if (profileCache.has(id)) return;
    let stale = false;
    void (async () => {
      let fetched: GoogleProfile = {};
      try {
        fetched = await fetchGoogleProfile(id, apiKey);
      } catch {
        // Degrade — name + secondaryText still render.
      }
      profileCache.set(id, fetched);
      if (!stale) setFetchedId(id);
    })();
    return () => {
      stale = true;
    };
  }, [open, prediction, apiKey]);

  const address =
    profile?.formattedAddress ?? prediction?.secondaryText ?? null;
  const mapsUrl = prediction
    ? (profile?.googleMapsUri ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        prediction.mainText,
      )}&query_place_id=${encodeURIComponent(prediction.placeId)}`)
    : '';

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityLabel="Place preview"
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityLabel="Dismiss place preview"
        />
        <View
          className="max-h-[92%] rounded-t-3xl border-t border-border bg-card"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          accessibilityViewIsModal
          accessibilityLabel="Place preview"
        >
          <View className="items-center pt-2 pb-1">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          {prediction ? (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 8,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="mb-1 flex-row items-start justify-end">
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={12}
                  className="h-8 w-8 items-center justify-center rounded-full bg-muted/60"
                >
                  <X color={COLORS.mutedForeground} size={16} />
                </Pressable>
              </View>

              <GooglePlacePreview
                mainText={prediction.mainText}
                photoUrl={profile?.photoUrl}
                address={address}
                mapsUrl={mapsUrl}
              />

              {added ? (
                <View className="mt-4 flex-row items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                  <ActivityIndicator color="#047857" size="small" />
                  <Text className="flex-1 text-xs font-medium leading-relaxed text-emerald-700">
                    Being added — our AI is generating this place’s profile;
                    it’ll be live on Mesita in about 5 minutes.
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onAdd(prediction)}
                  disabled={adding}
                  accessibilityRole="button"
                  accessibilityLabel={
                    adding ? 'Adding to Mesita' : 'Add to Mesita'
                  }
                  accessibilityState={{ disabled: adding, busy: adding }}
                  className="mt-4 h-12 overflow-hidden rounded-xl"
                  style={SHADOW_GLOW}
                >
                  <LinearGradient
                    colors={[...GRADIENTS.pink]}
                    start={GRADIENT_DIAGONAL.start}
                    end={GRADIENT_DIAGONAL.end}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: adding ? 0.7 : 1,
                    }}
                  >
                    {adding ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Wand2 color="#fff" size={16} />
                    )}
                    <Text className="text-sm font-semibold text-white">
                      {adding ? 'Adding…' : 'Add to Mesita'}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
