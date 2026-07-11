import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, MapPinPlus, Wand2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AddState } from '@/components/memo/types';
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
    <Portal>
      <Modal
        visible={open}
        onDismiss={onClose}
        contentContainerStyle={{
          flex: 1,
          backgroundColor: '#fff7f8',
          margin: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Appbar.Header style={{ backgroundColor: '#fff7f8' }} elevated>
            <Appbar.Content title="Add to Mesita" />
            <Appbar.Action icon="close" onPress={onClose} />
          </Appbar.Header>

          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <Card mode="elevated" style={{ borderRadius: 16, overflow: 'hidden' }}>
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
              <Card.Content style={{ paddingTop: 16, gap: 4 }}>
                <Text variant="titleLarge">{prediction.mainText}</Text>
                {address ? (
                  <Text variant="bodyMedium" style={{ color: '#775254' }}>
                    {address}
                  </Text>
                ) : null}
                <Button
                  mode="text"
                  icon={() => <ExternalLink color="#fb2b7b" size={14} />}
                  onPress={() => void Linking.openURL(mapsUrl)}
                  compact
                  style={{ alignSelf: 'flex-start', marginLeft: -8 }}
                >
                  Open in Google Maps
                </Button>
              </Card.Content>
            </Card>

            <Card mode="outlined" style={{ marginTop: 16, borderRadius: 16 }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Wand2 color="#fb2b7b" size={18} />
                  <Text variant="titleSmall">We’ll build its profile</Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{ marginTop: 8, color: '#775254', lineHeight: 20 }}
                >
                  Adding creates a Mesita listing right away. Our AI enriches the
                  profile in about five minutes.
                </Text>
              </Card.Content>
            </Card>

            <View style={{ marginTop: 24 }}>
              {added ? (
                <Button mode="contained-tonal" disabled>
                  Added — enriching…
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={() => onAdd(prediction)}
                  loading={adding}
                  disabled={adding}
                  contentStyle={{ paddingVertical: 6 }}
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
    </Portal>
  );
}
