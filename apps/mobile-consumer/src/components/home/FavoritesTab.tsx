import { Heart } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useHomeDeck } from '@/hooks/use-home-deck';
import type { Place } from '@/lib/api/places';
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { toast } from '@/lib/toast';

import { FavoriteRow } from './FavoriteRow';

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
    toast.action('Removed from saved', {
      label: 'Undo',
      onClick: () => {
        upsertSavedPlacePreview(place);
        setSaved(place.id, true);
      },
    });
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
