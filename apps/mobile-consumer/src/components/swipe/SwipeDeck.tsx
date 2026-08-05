import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RotateCcw, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Reanimated shared values are mutated via `.value` by design — the React
// Compiler immutability rule does not understand that contract.
/* eslint-disable react-hooks/immutability */

import { ReservationSheet } from '@/components/place/place-detail/ReservationSheet';
import { PlaceSwipeCard } from '@/components/swipe/PlaceSwipeCard';
import { SwipeActionRow } from '@/components/swipe/SwipeActionRow';
import { SwipeDecisionBadge } from '@/components/swipe/SwipeDecisionBadge';
import {
  EmptyState,
  shuffleDeck,
  sortPartnersFirst,
  withUserDistance,
  type Coords,
} from '@/components/swipe/swipe-deck-shells';
import {
  SwipeExitStamp,
  SwipeTutorialOverlay,
} from '@/components/swipe/SwipeDeckOverlays';
import { requestHomeMode } from '@/components/swipe/home-mode-intent';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { filtersPath } from '@/lib/consumer-route-contract';
import { publishFiltersHostContext } from '@/lib/filters-host-context';
import {
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
  orderByRandomness,
} from '@/lib/discovery-filters-engine';
import {
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import {
  resetDiscoveryFilters,
  useDiscoveryFilters,
} from '@/lib/use-discovery-filters';
import { errMsg } from '@/lib/utils';
import { useSwipeTutorial } from './useSwipeTutorial';

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 800; // px/s — RNGH velocity is px/s, not px/ms
// Below this speed, translation is a more reliable direction signal than a
// twitchy low-velocity reading, so direction falls back to translationX.
const DIRECTION_VELOCITY_MIN = 120;
const EXIT_MS = 280;
const SCREEN_W = Dimensions.get('window').width;

async function fetchSwipeDeck(): Promise<Place[]> {
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    return sortPartnersFirst(result.deck);
  } catch (err) {
    console.warn('[swipe] recommend-swipe failed, falling back:', err);
    const fallback = await apiFetchPublicPlaces(supabase);
    return sortPartnersFirst(fallback);
  }
}

export function SwipeDeck() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [overridePlaces, setOverridePlaces] = useState<Place[] | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const { isSaved, setSaved } = useSavedPlaces();
  const { showTutorial, dismissTutorial } = useSwipeTutorial();

  // Shared discovery filters (MESITA-646/672): the deck below narrows LIVE, the
  // randomness level reorders it, and the red Filter dot lights on any
  // deviation from defaults. ONE global store — Search reads the exact same
  // state. Open via routed /filters (MESITA-905).
  const filters = useDiscoveryFilters();
  const filtersActive = discoveryFiltersAreActive(filters);

  const deckQuery = useQuery({
    queryKey: ['swipe-deck'],
    queryFn: fetchSwipeDeck,
  });

  const places = useMemo(
    () => overridePlaces ?? deckQuery.data ?? [],
    [overridePlaces, deckQuery.data],
  );
  const fetchError =
    deckQuery.isError && !overridePlaces
      ? errMsg(deckQuery.error, 'Failed to load places.')
      : null;

  // Soft geolocation — web parity distance chips. Denied/unavailable → "- km".
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Distances measure from the chosen zone center (a searched location) or, with
  // none, the device fix — the SAME center the distance filter rings.
  const center: Coords | null = filters.zone ?? coords;
  const located = useMemo(
    () => places.map((p) => withUserDistance(p, center)),
    [places, center],
  );

  // The deck the user actually swipes: the shared filters narrow `located` live
  // and the randomness level reorders it. Category options derive from the RAW
  // snapshot so the sheet always offers everything this deck actually has.
  const deck = useMemo(
    () =>
      orderByRandomness(
        applyDiscoveryFilters(located, filters),
        filters.randomness,
      ),
    [located, filters],
  );
  const categoryOptions = useMemo(
    () => deriveCategoryOptions(places),
    [places],
  );

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

  const restart = useCallback(async () => {
    if (restarting) return;
    setRestarting(true);
    try {
      const result = await apiRecommendDeck(supabase, { limit: 50 });
      setOverridePlaces(shuffleDeck(sortPartnersFirst(result.deck)));
      setIdx(0);
    } catch {
      const refreshed = await deckQuery.refetch();
      if (refreshed.data) setOverridePlaces(shuffleDeck(refreshed.data));
      setIdx(0);
    } finally {
      setRestarting(false);
    }
  }, [deckQuery, restarting]);

  if (deckQuery.isLoading && !overridePlaces) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb2b7b" size="large" />
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

  // Genuinely empty catalog — no places at all, no predicates to blame. Existing
  // copy, no reset (MESITA-670).
  if (places.length === 0) {
    return (
      <EmptyState
        title="No places yet"
        body="The catalog is empty. As partners onboard, their places will show up here."
      />
    );
  }

  // Filters excluded EVERYTHING — the catalog isn't empty, the user's predicates
  // did it. A distinct state from "caught up": offer a way out, not a restart.
  if (deck.length === 0) {
    return (
      <View className="flex-1">
        <FilterEmptyState
          onAdjust={openFilters}
          onReset={resetDiscoveryFilters}
        />
      </View>
    );
  }

  // Past the last card in the (filtered) deck — caught up. Existing copy +
  // Start over; no reset (MESITA-670).
  if (idx >= deck.length) {
    return (
      <View className="flex-1">
        <EmptyState
          title="You're caught up"
          body="You've seen every place in this deck. Start over from the top."
          actionLabel={restarting ? 'Loading...' : 'Start over'}
          onAction={restart}
          actionDisabled={restarting}
          actionIcon={restarting ? undefined : RotateCcw}
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <DeckBody
        places={deck}
        idx={idx}
        setIdx={setIdx}
        isSaved={isSaved}
        setSaved={setSaved}
        showTutorial={showTutorial}
        dismissTutorial={dismissTutorial}
        filtersActive={filtersActive}
        onOpenFilters={openFilters}
      />
    </View>
  );
}

// Two-branch empty state, filtered branch: predicates excluded everything.
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
        <SlidersHorizontal color="#775254" size={24} />
      </View>
      <Text className="text-center font-display text-2xl font-semibold text-foreground">
        Nothing matches your filters
      </Text>
      <Text className="max-w-xs text-center text-sm text-muted-foreground">
        Loosen or clear your filters to see more places.
      </Text>
      <View className="mt-2 flex-row items-center gap-2.5">
        <Pressable
          onPress={onAdjust}
          accessibilityRole="button"
          accessibilityLabel="Adjust filters"
          className="rounded-lg border border-border bg-card px-5 py-2.5 active:bg-muted"
        >
          <Text className="text-sm font-semibold text-foreground">
            Adjust filters
          </Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel="Reset filters"
          className="flex-row items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 active:opacity-90"
        >
          <RotateCcw color="#fff7f8" size={16} />
          <Text className="text-sm font-semibold text-background">
            Reset filters
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DeckBody({
  places,
  idx,
  setIdx,
  isSaved,
  setSaved,
  showTutorial,
  dismissTutorial,
  filtersActive,
  onOpenFilters,
}: {
  places: Place[];
  idx: number;
  setIdx: (fn: (i: number) => number) => void;
  isSaved: (id: string) => boolean;
  setSaved: (id: string, saved: boolean) => void;
  showTutorial: boolean;
  dismissTutorial: () => void;
  filtersActive: boolean;
  onOpenFilters: () => void;
}) {
  const router = useRouter();
  const v = places[idx]!;
  const next = idx + 1 < places.length ? places[idx + 1]! : null;
  const [stamp, setStamp] = useState<null | 'left' | 'right'>(null);
  // Reserve opens the booking sheet over the deck — the card already carries
  // the id + name the sheet needs, so there's no detour through /place/[id].
  const [reserveOpen, setReserveOpen] = useState(false);

  const translateX = useSharedValue(0);
  const exiting = useSharedValue(0); // 0 idle, -1 left, 1 right

  const advance = useCallback(() => {
    setStamp(null);
    translateX.value = 0;
    exiting.value = 0;
    setIdx((i) => i + 1);
  }, [exiting, setIdx, translateX]);

  const beginExit = useCallback(
    (dir: 'left' | 'right') => {
      if (exiting.value !== 0) return;
      dismissTutorial();
      if (dir === 'right') {
        // Save + a "Saved · View" toast, only on a fresh save (web parity).
        // "View" asks the Home hub to switch to Favorites (see home-mode-intent).
        const already = isSaved(v.id);
        upsertSavedPlacePreview(v);
        setSaved(v.id, true);
        if (!already) {
          toast.action(
            `Saved ${v.name}`,
            { label: 'View', onClick: () => requestHomeMode('favorites') },
            { tone: 'success' },
          );
        }
      }
      setStamp(dir);
      exiting.value = dir === 'right' ? 1 : -1;
      translateX.value = withTiming(
        dir === 'right' ? SCREEN_W * 1.2 : -SCREEN_W * 1.2,
        { duration: EXIT_MS },
        (finished) => {
          if (finished) runOnJS(advance)();
        },
      );
    },
    [advance, dismissTutorial, exiting, isSaved, setSaved, translateX, v],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      if (exiting.value !== 0) return;
      translateX.value = e.translationX;
    })
    .onBegin(() => {
      runOnJS(dismissTutorial)();
    })
    .onEnd((e) => {
      if (exiting.value !== 0) return;
      const shouldCommit =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (shouldCommit) {
        const dir =
          (Math.abs(e.velocityX) > DIRECTION_VELOCITY_MIN
            ? e.velocityX
            : e.translationX) > 0
            ? 'right'
            : 'left';
        runOnJS(beginExit)(dir);
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const frontStyle = useAnimatedStyle(() => {
    const rot = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-14, 0, 14],
      Extrapolation.CLAMP,
    );
    const y = Math.abs(translateX.value) * 0.04;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: y },
        { rotate: `${rot}deg` },
      ],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const scale = 0.94 + 0.06 * progress;
    const offsetY = 14 - 14 * progress;
    const opacity = 0.7 + 0.3 * progress;
    return {
      transform: [{ translateY: offsetY }, { scale }],
      opacity,
    };
  });

  const saved = isSaved(v.id);

  return (
    <View className="flex-1 px-3 pt-2 pb-3">
      <View className="relative flex-1 overflow-hidden rounded-2xl">
        {next ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
              backStyle,
            ]}
            pointerEvents="none"
          >
            <PlaceSwipeCard key={next.id} place={next} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, frontStyle]}>
            <PlaceSwipeCard key={v.id} place={v} />

            <SwipeDecisionBadge side="left" translateX={translateX} />
            <SwipeDecisionBadge side="right" translateX={translateX} />
          </Animated.View>
        </GestureDetector>

        <SwipeExitStamp direction={stamp} />

        {showTutorial ? <SwipeTutorialOverlay /> : null}
      </View>

      <View className="mt-3 flex-row items-center justify-center gap-3.5">
        <SwipeActionRow
          saved={saved}
          filtersActive={filtersActive}
          onOpenFilters={onOpenFilters}
          onSkip={() => beginExit('left')}
          onOpenInfo={() => router.push(`/place/${v.id}`)}
          onSave={() => beginExit('right')}
          onReserve={() => setReserveOpen(true)}
        />
      </View>

      <ReservationSheet
        place={{ id: v.id, name: v.name }}
        visible={reserveOpen}
        onClose={() => setReserveOpen(false)}
      />
    </View>
  );
}
