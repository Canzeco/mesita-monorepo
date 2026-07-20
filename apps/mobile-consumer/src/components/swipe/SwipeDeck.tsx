import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  RotateCcw,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { FiltersComingSoonSheet } from '@/components/ui/FiltersComingSoon';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { placePath } from '@/lib/consumer-route-contract';
import {
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import { errMsg } from '@/lib/utils';
import { useSwipeTutorial } from './useSwipeTutorial';

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 800; // px/s — RNGH velocity is px/s, not px/ms
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
  const [idx, setIdx] = useState(0);
  const [overridePlaces, setOverridePlaces] = useState<Place[] | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const { isSaved, setSaved } = useSavedPlaces();
  const { showTutorial, dismissTutorial } = useSwipeTutorial();

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

  const located = useMemo(
    () => places.map((p) => withUserDistance(p, coords)),
    [places, coords],
  );

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

  if (places.length === 0) {
    return (
      <EmptyState
        title="No places yet"
        body="The catalog is empty. As partners onboard, their places will show up here."
      />
    );
  }

  if (idx >= located.length) {
    return (
      <EmptyState
        title="You're caught up"
        body="You've seen every place in this deck. Start over from the top."
        actionLabel={restarting ? 'Loading...' : 'Start over'}
        onAction={restart}
        actionDisabled={restarting}
        actionIcon={restarting ? undefined : RotateCcw}
      />
    );
  }

  return (
    <DeckBody
      places={located}
      idx={idx}
      setIdx={setIdx}
      isSaved={isSaved}
      setSaved={setSaved}
      showTutorial={showTutorial}
      dismissTutorial={dismissTutorial}
    />
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
}: {
  places: Place[];
  idx: number;
  setIdx: (fn: (i: number) => number) => void;
  isSaved: (id: string) => boolean;
  setSaved: (id: string, saved: boolean) => void;
  showTutorial: boolean;
  dismissTutorial: () => void;
}) {
  const router = useRouter();
  const v = places[idx]!;
  const next = idx + 1 < places.length ? places[idx + 1]! : null;
  const [stamp, setStamp] = useState<null | 'left' | 'right'>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        upsertSavedPlacePreview(v);
        setSaved(v.id, true);
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
    [advance, dismissTutorial, exiting, setSaved, translateX, v],
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
          (Math.abs(e.velocityX) > 120 ? e.velocityX : e.translationX) > 0
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
            <PlaceSwipeCard place={next} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, frontStyle]}>
            <PlaceSwipeCard place={v} />

            <SwipeDecisionBadge side="left" translateX={translateX} />
            <SwipeDecisionBadge side="right" translateX={translateX} />
          </Animated.View>
        </GestureDetector>

        <SwipeExitStamp direction={stamp} />

        {showTutorial ? <SwipeTutorialOverlay /> : null}
      </View>

      <View className="mt-3 flex-row items-center gap-1.5">
        <SwipeActionRow
          saved={saved}
          onOpenFilters={() => setFiltersOpen(true)}
          onSkip={() => beginExit('left')}
          onOpenInfo={() => router.push(placePath(v.id))}
          onSave={() => beginExit('right')}
        />
      </View>

      <FiltersComingSoonSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}
