import { ArrowUpDown, Heart } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { requestHomeMode } from '@/components/swipe/home-mode-intent';
import { useHomeDeck } from '@/hooks/use-home-deck';
import type { Place } from '@/lib/api/places';
import { pairs } from '@/lib/grid-pairs';
import { enrichPlaceOverview } from '@/lib/place-overview';
import {
  readSavedPlacePreviews,
  removeSavedPlacePreview,
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { toast } from '@/lib/toast';

import { FavoriteTile } from './FavoriteTile';

// Favorites mode — mirror of web components/consumer/home/FavoritesList.tsx.
//
// Layout: a two-column photo grid of saved places only — count header plus
// filled-heart tiles. This tab is the bookmark list, not a second discovery
// surface: no similar-places rail.
//
// RN has no CSS grid, so rows are chunked into pairs (see lib/grid-pairs) —
// that yields exact halves with a real gap, which percentage widths can't do
// without calc().

/** Saves past this count earn a sort control; below it, it's chrome. */
const SORT_CONTROL_MIN = 4;

type Sort = 'recent' | 'open';

export function FavoritesTab() {
  const deckQuery = useHomeDeck();
  const deckPlaces = useMemo(() => deckQuery.data ?? [], [deckQuery.data]);
  const { savedIds, hydrated, setSaved } = useSavedPlaces();
  const [previewCatalog, setPreviewCatalog] = useState<Map<string, Place>>(
    () => new Map(),
  );
  const [pendingRemove, setPendingRemove] = useState<Place | null>(null);
  const [sort, setSort] = useState<Sort>('recent');

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

  // Newest first. The store appends on save, so insertion order is
  // oldest-first — reversing puts the save you just made in the hero slot,
  // which is where you look for it.
  const places = useMemo(
    () =>
      [...savedIds]
        .reverse()
        .map((id) => catalog.get(id))
        .filter((v): v is Place => v != null)
        .map((v) => enrichPlaceOverview(v)),
    [savedIds, catalog],
  );

  // Saved ids that resolved to neither the deck nor a preview. These used to
  // vanish silently — you saved three places and the screen showed two with no
  // explanation.
  const unresolved = Math.max(0, savedIds.size - places.length);
  const openNow = places.filter((p) => p.open_now === true).length;

  const ordered = useMemo(() => {
    if (sort === 'recent') return places;
    // Open first, each group keeping its recency order (Array.sort is stable).
    return [...places].sort(
      (a, b) => Number(b.open_now === true) - Number(a.open_now === true),
    );
  }, [places, sort]);

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

  // savedIds is empty until AsyncStorage is read, so branching on length before
  // `hydrated` flashes "nothing saved" at everyone who has saves.
  if (!hydrated || (deckQuery.isLoading && places.length === 0)) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" />
      </View>
    );
  }

  // Gate the zero state on what was SAVED, not on what resolved. A consumer
  // with three saves and a failed deck resolves to zero places — telling them
  // "nothing saved yet" would be the silent drop wearing a different hat. With
  // saves on record we fall through and the notice explains the gap.
  if (savedIds.size === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Nothing saved yet"
        description="Swipe right on a place and it lands here — with its discount attached."
        action={{
          label: 'Start swiping',
          onPress: () => requestHomeMode('swipe'),
        }}
      />
    );
  }

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-6">
        <View className="mb-3 flex-row items-center justify-between gap-2 px-1">
          <Text className="text-xs font-semibold text-muted-foreground">
            <Text className="text-foreground">{savedIds.size} saved</Text>
            {openNow > 0 ? ` · ${openNow} open now` : ''}
          </Text>
          {places.length >= SORT_CONTROL_MIN ? (
            <Pressable
              onPress={() => setSort((s) => (s === 'recent' ? 'open' : 'recent'))}
              accessibilityLabel="Change sort order"
              className="flex-row items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1"
            >
              <ArrowUpDown color="#775254" size={12} />
              <Text className="text-[11px] font-semibold text-muted-foreground">
                {sort === 'recent' ? 'Recent' : 'Open first'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {unresolved > 0 ? (
          <View className="mb-3 rounded-lg bg-muted px-3 py-2">
            <Text className="text-[11.5px] leading-snug text-muted-foreground">
              {unresolved} saved {unresolved === 1 ? 'place' : 'places'} couldn
              &apos;t be loaded right now.
            </Text>
          </View>
        ) : null}

        <View className="gap-2.5">
          {pairs(ordered).map((row) => (
            <View key={row[0].id} className="flex-row gap-2.5">
              {row.map((place) => (
                <FavoriteTile
                  key={place.id}
                  place={place}
                  saved
                  onToggle={() => setPendingRemove(place)}
                />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
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
