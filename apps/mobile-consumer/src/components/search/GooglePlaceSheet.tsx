import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AddState } from '@/components/memo/types';
import { GooglePlacePreview } from '@/components/search/google-place-preview';
import { Button } from '@/components/ui/Button';
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
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }}>
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text
            className="font-display font-bold text-foreground"
            style={{ fontSize: 20 }}
          >
            Add to Mesita
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-muted"
          >
            <X color="#260409" size={20} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          <GooglePlacePreview
            mainText={prediction.mainText}
            photoUrl={profile?.photoUrl}
            address={address}
            mapsUrl={mapsUrl}
          />

          <View style={{ marginTop: 24 }}>
            {added ? (
              <Button variant="outline" disabled>
                Added — enriching…
              </Button>
            ) : (
              <Button
                onPress={() => onAdd(prediction)}
                loading={adding}
                disabled={adding}
                accessibilityLabel="Add to Mesita"
              >
                Add to Mesita
              </Button>
            )}
            {adding ? (
              <ActivityIndicator style={{ marginTop: 12 }} color="#fb2b7b" />
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
