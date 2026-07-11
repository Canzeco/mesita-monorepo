import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Heart, Navigation } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import { useHomeDeck } from '@/hooks/use-home-deck';
import type { Place } from '@/lib/api/places';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { firstInitial } from '@/lib/utils';

export function FavoritesTab() {
  const deckQuery = useHomeDeck();
  const deckPlaces = useMemo(
    () => deckQuery.data ?? [],
    [deckQuery.data],
  );
  const { savedIds, setSaved } = useSavedPlaces();
  const [previewCatalog, setPreviewCatalog] = useState<Map<string, Place>>(
    () => new Map(),
  );
  const [pendingRemove, setPendingRemove] = useState<Place | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSavedPlacePreviews<Place>().then((map) => {
      if (!cancelled) setPreviewCatalog(map);
    });
    return () => {
      cancelled = true;
    };
  }, [savedIds]);

  const catalog = useMemo(() => {
    const merged = new Map<string, Place>();
    for (const [id, place] of previewCatalog) merged.set(id, place);
    for (const place of deckPlaces) merged.set(place.id, place);
    return merged;
  }, [deckPlaces, previewCatalog]);

  const places = useMemo(
    () =>
      [...savedIds]
        .map((id) => catalog.get(id))
        .filter((v): v is Place => v != null),
    [savedIds, catalog],
  );

  const confirmRemove = (place: Place) => {
    setSaved(place.id, false);
    removeSavedPlacePreview(place.id);
    setPendingRemove(null);
  };

  if (deckQuery.isLoading && places.length === 0 && savedIds.size === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-6"
      >
        {places.length === 0 ? (
          <View className="mt-6 items-center rounded-3xl border border-dashed border-border bg-card/60 p-8">
            <View className="size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Heart color="#fb2b7b" size={28} />
            </View>
            <Text className="mt-3 font-display text-lg font-semibold text-foreground">
              No saves yet
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Swipe right on a place to save it for later.
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-3 flex-row items-center justify-between px-1">
              <Text className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Saved
              </Text>
              <View className="rounded-full bg-primary/10 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-primary">
                  {places.length}
                </Text>
              </View>
            </View>
            <View className="gap-2.5">
              {places.map((place) => (
                <FavoriteRow
                  key={place.id}
                  place={place}
                  onRemove={() => setPendingRemove(place)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={pendingRemove != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-8"
          onPress={() => setPendingRemove(null)}
        >
          <Pressable
            className="w-full rounded-2xl border border-border bg-card p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="size-12 items-center justify-center rounded-2xl bg-rose-500/10">
              <Heart color="#f43f5e" fill="#f43f5e" size={24} />
            </View>
            <Text className="mt-3 font-display text-lg font-semibold text-foreground">
              Remove from saved?
            </Text>
            <Text className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {pendingRemove
                ? `“${pendingRemove.name}” will be removed from your saved places.`
                : 'This place will be removed from your saved places.'}
            </Text>
            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                onPress={() => setPendingRemove(null)}
                className="flex-1 items-center rounded-xl border border-border bg-card py-3"
              >
                <Text className="text-sm font-semibold text-foreground">No</Text>
              </Pressable>
              <Pressable
                onPress={() => pendingRemove && confirmRemove(pendingRemove)}
                className="flex-1 items-center rounded-xl bg-rose-500 py-3"
              >
                <Text className="text-sm font-semibold text-white">
                  Yes, remove
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FavoriteRow({
  place,
  onRemove,
}: {
  place: Place;
  onRemove: () => void;
}) {
  const photo = place.photos[0];
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? `${place.distance_km} km`
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(' · ');
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const isPartner = place.listing_type === 'partner';
  const promoPercent = isPartner
    ? resolvePromoRateFromPlaceRow(
        place as unknown as Record<string, unknown>,
        place.is_first_visit !== false,
        false,
      )
    : null;

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center gap-3"
        onPress={() =>
          Alert.alert(place.name, 'Place detail is coming soon.')
        }
      >
        <View className="size-16 overflow-hidden rounded-xl bg-muted">
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
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="font-display text-xl font-bold text-white/85">
                {firstInitial(place.name)}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="font-display text-[15px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {subtitle ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Navigation color="#775254" size={12} />
              <Text
                className="flex-1 text-xs text-muted-foreground"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          ) : null}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {openingLabel ? (
              <View className="flex-row items-center gap-1">
                <View
                  className={`size-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                />
                <Text
                  className={`text-[11px] font-medium ${isOpen ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  {openingLabel}
                </Text>
              </View>
            ) : null}
            {promoPercent != null ? (
              <View className="flex-row items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5">
                <Gift color="#fb2b7b" size={10} />
                <Text className="text-[10.5px] font-semibold text-primary">
                  {promoPercent}% OFF
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={onRemove}
        accessibilityLabel={`Remove ${place.name} from saved`}
        className="size-8 items-center justify-center rounded-full bg-rose-500/10 active:scale-90"
      >
        <Heart color="#f43f5e" fill="#f43f5e" size={16} />
      </Pressable>
    </View>
  );
}
