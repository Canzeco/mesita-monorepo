import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, MapPinPlus, Wand2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AddState } from '@/components/memo/types';
import { GradientButton } from '@/components/ui/gradient-button';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { PlacePrediction } from '@/lib/api/places';

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
        // Degrade gracefully — name + secondaryText still render.
      }
      profileCache.set(id, fetched);
      if (!stale) setFetchedId(id);
    })();
    return () => {
      stale = true;
    };
  }, [open, prediction, apiKey]);

  if (!prediction) return null;

  const address =
    profile?.formattedAddress ?? prediction.secondaryText ?? null;
  const mapsUrl =
    profile?.googleMapsUri ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      prediction.mainText,
    )}&query_place_id=${encodeURIComponent(prediction.placeId)}`;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="font-display text-lg font-semibold text-foreground">
            Add to Mesita
          </Text>
          <Pressable
            onPress={onClose}
            className="size-9 items-center justify-center rounded-full bg-muted"
          >
            <X color="#260409" size={18} />
          </Pressable>
        </View>

        <View className="flex-1 px-4 pt-4">
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            {profile?.photoUrl ? (
              <Image
                source={{ uri: profile.photoUrl }}
                style={{ width: '100%', height: 180 }}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  height: 140,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPinPlus color="#fff" size={36} />
              </LinearGradient>
            )}
            <View className="gap-1 p-4">
              <Text className="font-display text-xl font-bold text-foreground">
                {prediction.mainText}
              </Text>
              {address ? (
                <Text className="text-sm text-muted-foreground">{address}</Text>
              ) : null}
              <Pressable
                onPress={() => void Linking.openURL(mapsUrl)}
                className="mt-2 flex-row items-center gap-1.5 self-start"
              >
                <ExternalLink color="#fb2b7b" size={14} />
                <Text className="text-sm font-semibold text-primary">
                  Open in Google Maps
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-5 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center gap-2">
              <Wand2 color="#fb2b7b" size={18} />
              <Text className="text-sm font-semibold text-foreground">
                We’ll build its profile
              </Text>
            </View>
            <Text className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Adding creates a Mesita listing right away. Our AI enriches the
              profile in about five minutes.
            </Text>
          </View>

          <View className="mt-6">
            {added ? (
              <View className="items-center rounded-xl bg-primary/10 py-3.5">
                <Text className="text-sm font-semibold text-primary">
                  Added — enriching…
                </Text>
              </View>
            ) : (
              <GradientButton
                label={adding ? 'Adding…' : 'Add to Mesita'}
                onPress={() => onAdd(prediction)}
                loading={adding}
                disabled={adding}
              />
            )}
            {adding ? (
              <ActivityIndicator className="mt-3" color="#fb2b7b" />
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
