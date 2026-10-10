import { useQuery } from '@tanstack/react-query';
import { type Href, useRouter } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ReservationSheet } from '@/components/place/place-detail/ReservationSheet';
import { ScrollCard } from '@/components/scroll/ScrollCard';
import {
  EmptyState,
  sortPartnersFirst,
  withUserDistance,
  type Coords,
} from '@/components/swipe/swipe-deck-shells';
import { COLORS } from '@/constants/brand';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { CONSUMER_ROUTES, filtersPath } from '@/lib/consumer-route-contract';
import { cycleDeck } from '@/lib/cycle-deck';
import {
  applyDiscoveryFilters,
  createSeededRandom,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
  orderByRandomness,
} from '@/lib/discovery-filters-engine';
import { publishFiltersHostContext } from '@/lib/filters-host-context';
import {
  SCROLL_USES_MOCK,
  isMockPlace,
  scrollMockPlaces,
} from '@/lib/mock/scroll-places';
import { upsertSavedPlacePreview, useSavedPlaces } from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';
import { errMsg } from '@/lib/utils';

// Home › Scroll — web's TikTok feed, native (MESITA-2105, design 8A). It
// replaced the left/right card stack (SwipeDeck) on this tab: one place per
// screen, vertical paging, the same card, the same mock, the same actions.
//
// THE MOCK SWITCH (design 2A). While SCROLL_USES_MOCK is on, the feed reads
// ONLY the twelve shared mock places and the deck query never runs. Off, it is
// SwipeDeck's real path carried over WITHOUT CHANGE: the ranked deck EF with
// the catalog fallback, the guest's filters and Randomness on top, cycled to
// 50. Lining that path up with web's (which has no Randomness reorder) is
// MESITA-2095's job, when the switch flips and someone can see the result.
//
// ONLY ~3 CARDS ARE MOUNTED (eng review R3): `windowSize={3}` keeps the card
// on screen and its neighbours, so only they ask expo-image for photos.

/** The deck EF RANKS and BANDS (MESITA-2047); its order is kept as it
 *  arrives. Only the catalog fallback, which nothing ranked, floats partners. */
async function fetchSwipeDeck(): Promise<Place[]> {
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    return result.deck;
  } catch (err) {
    console.warn('[scroll] consumer-web-recommend-swipe failed, falling back:', err);
    const fallback = await apiFetchPublicPlaces(supabase);
    return sortPartnersFirst(fallback);
  }
}

/** What a mock card says when you ask it for something real (design 3A). */
export const SAMPLE_PLACE_TOAST = 'Sample place — real places land here soon';

/**
 * Where a card's actions go — web's `scrollCardActions`, native. A mock card
 * toasts for Profile, Share and Go and keeps its heart in memory; nothing
 * reaches Favs, a place screen or a reservation. A real card does what the
 * old deck did: Favs (+ a "Saved · View" toast), the place screen, the share
 * sheet, and the reservation sheet behind Go.
 */
export function scrollCardActions(
  place: Place,
  deps: {
    isMock: boolean;
    isSaved: (id: string) => boolean;
    mockSavedIds: ReadonlySet<string>;
    toast: (message: string) => void;
    saveReal: (place: Place, saved: boolean) => void;
    setMockSaved: (id: string, saved: boolean) => void;
    openProfile: (place: Place) => void;
    share: (place: Place) => void;
    openGo: (place: Place) => void;
  },
) {
  const sample = () => deps.toast(SAMPLE_PLACE_TOAST);
  if (deps.isMock) {
    const saved = deps.mockSavedIds.has(place.id);
    return {
      saved,
      onProfile: sample,
      onToggleSave: () => deps.setMockSaved(place.id, !saved),
      onShare: sample,
      onGo: sample,
    };
  }
  const saved = deps.isSaved(place.id);
  return {
    saved,
    onProfile: () => deps.openProfile(place),
    onToggleSave: () => deps.saveReal(place, !saved),
    onShare: () => deps.share(place),
    onGo: () => deps.openGo(place),
  };
}

export function ScrollFeed() {
  const router = useRouter();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [reservePlace, setReservePlace] = useState<Place | null>(null);
  const [mockSavedIds, setMockSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const { isSaved, setSaved } = useSavedPlaces();
  const listRef = useRef<FlatList<Place | 'end'>>(null);

  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);

  const deckQuery = useQuery({
    queryKey: ['swipe-deck'],
    queryFn: fetchSwipeDeck,
    // The mock never asks the server (design 2A).
    enabled: !SCROLL_USES_MOCK,
  });

  const mockPlaces = useMemo(() => scrollMockPlaces(), []);
  const places = useMemo(
    () => (SCROLL_USES_MOCK ? mockPlaces : (deckQuery.data ?? [])),
    [mockPlaces, deckQuery.data],
  );
  const fetchError =
    !SCROLL_USES_MOCK && deckQuery.isError
      ? errMsg(deckQuery.error, 'Failed to load places.')
      : null;

  // Soft geolocation — distance on the card. Denied/unavailable → no distance.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const center: Coords | null = filters.zone ?? coords;
  const located = useMemo(
    () => places.map((p) => withUserDistance(p, center)),
    [places, center],
  );
  // Seeded so a late location fix cannot reshuffle the card under a thumb.
  const [orderSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const deck = useMemo(
    () =>
      orderByRandomness(
        applyDiscoveryFilters(located, filters),
        filters.randomness,
        createSeededRandom(orderSeed),
      ),
    [located, filters, orderSeed],
  );
  // What the guest scrolls: the deck cycled to 50. `deck` stays the REAL list —
  // the empty states and the Filters count read it, never 50.
  const cycled = useMemo(() => cycleDeck(deck), [deck]);
  const categoryOptions = useMemo(() => deriveCategoryOptions(places), [places]);

  useEffect(() => {
    publishFiltersHostContext({
      surface: 'swipe',
      count: deck.length,
      categoryOptions,
      hasLocation: coords != null,
    });
  }, [deck.length, categoryOptions, coords]);

  const openFilters = useCallback(() => {
    router.push(filtersPath());
  }, [router]);

  const setMockSaved = useCallback((id: string, saved: boolean) => {
    setMockSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const saveReal = useCallback(
    (place: Place, saved: boolean) => {
      if (!saved) {
        setSaved(place.id, false);
        return;
      }
      const already = isSaved(place.id);
      upsertSavedPlacePreview(place);
      setSaved(place.id, true);
      if (!already) {
        toast.action(
          `Saved ${place.name}`,
          {
            label: 'View',
            onClick: () => router.navigate(CONSUMER_ROUTES.discoverTabs.favs as Href),
          },
          { tone: 'success' },
        );
      }
    },
    [isSaved, router, setSaved],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || box.width !== width || box.height !== height) setBox({ width, height });
  };

  if (!SCROLL_USES_MOCK && deckQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-foreground">
        <ActivityIndicator color={COLORS.onMedia} size="large" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <EmptyState
        title="Couldn't load places"
        body={fetchError}
        actionLabel="Try again"
        onAction={() => {
          void deckQuery.refetch();
        }}
      />
    );
  }

  if (places.length === 0) {
    return (
      <EmptyState
        title="No places yet"
        body="The catalog is empty. As places join Mesita, they'll show up here."
      />
    );
  }

  const filtersDisc = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={filtersActive ? 'Filters, applied' : 'Filter places'}
      onPress={openFilters}
      className={`absolute right-3 top-3 z-20 size-11 items-center justify-center rounded-full border ${
        filtersActive ? 'border-primary bg-primary' : 'border-border bg-card'
      }`}
    >
      <SlidersHorizontal
        size={16}
        strokeWidth={2.25}
        color={filtersActive ? COLORS.primaryForeground : COLORS.foreground}
      />
    </Pressable>
  );

  if (deck.length === 0) {
    return (
      <View className="flex-1">
        {filtersDisc}
        <FilterEmptyState onAdjust={openFilters} onReset={resetDiscoveryFilters} />
      </View>
    );
  }

  const data: (Place | 'end')[] = [...cycled, 'end'];

  return (
    <View className="flex-1 bg-foreground" onLayout={onLayout}>
      {box ? (
        <FlatList
          ref={listRef}
          data={data}
          // A repeated place needs its position in the key, or it never remounts.
          keyExtractor={(item, i) => (item === 'end' ? 'end' : `${item.id}-${i}`)}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          getItemLayout={(_d, i) => ({ length: box.height, offset: box.height * i, index: i })}
          accessibilityLabel="Places"
          renderItem={({ item, index }) => {
            if (item === 'end') {
              return (
                <View
                  style={{ width: box.width, height: box.height }}
                  className="items-center justify-center gap-4 bg-background px-6"
                >
                  <View className="items-center">
                    <Text className="font-display text-base font-semibold text-foreground">
                      That&apos;s everywhere for now
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground">
                      You&apos;ve reached the end of tonight&apos;s places.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                    className="h-11 items-center justify-center rounded-full bg-foreground px-5"
                  >
                    <Text className="text-sm font-semibold text-primary-foreground">Back to top</Text>
                  </Pressable>
                </View>
              );
            }
            const actions = scrollCardActions(item, {
              isMock: isMockPlace(item),
              isSaved,
              mockSavedIds,
              toast,
              saveReal,
              setMockSaved,
              openProfile: (p) => router.push(`/place/${p.id}` as Href),
              share: (p) =>
                void Share.share({
                  message: `${p.name} on Mesita: https://consumer.mesita.ai/place/${p.slug ?? p.id}`,
                }).catch(() => undefined),
              openGo: setReservePlace,
            });
            return (
              <ScrollCard
                place={item}
                index={index}
                total={cycled.length}
                width={box.width}
                height={box.height}
                {...actions}
              />
            );
          }}
        />
      ) : null}

      {filtersDisc}

      {reservePlace ? (
        <ReservationSheet
          place={{ id: reservePlace.id, name: reservePlace.name }}
          visible
          onClose={() => setReservePlace(null)}
        />
      ) : null}
    </View>
  );
}

// Predicates excluded everything — the catalog isn't empty, the guest's
// filters did it. Offer a way out.
function FilterEmptyState({
  onAdjust,
  onReset,
}: {
  onAdjust: () => void;
  onReset: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="size-14 items-center justify-center rounded-2xl bg-muted">
        <SlidersHorizontal color={COLORS.mutedForeground} size={24} />
      </View>
      <Text className="text-center font-display text-2xl font-semibold text-foreground">
        Nothing matches your filters
      </Text>
      <Text className="max-w-xs text-center text-sm text-muted-foreground">
        Loosen or clear your filters to see more places.
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onAdjust}
          className="h-11 items-center justify-center rounded-full border border-border bg-card px-5"
        >
          <Text className="text-sm font-semibold text-foreground">Adjust filters</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          className="h-11 items-center justify-center rounded-full bg-foreground px-5"
        >
          <Text className="text-sm font-semibold text-primary-foreground">Reset filters</Text>
        </Pressable>
      </View>
    </View>
  );
}
