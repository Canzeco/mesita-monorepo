import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  CalendarCheck,
  Compass,
  Hand,
  Heart,
  RotateCcw,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react-native';
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

import { PlaceSwipeCard } from '@/components/swipe/PlaceSwipeCard';
import { FiltersComingSoonSheet } from '@/components/ui/FiltersComingSoon';
import { GRADIENTS, GRADIENT_DIAGONAL, SHADOW_GLOW } from '@/constants/brand';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import {
  upsertSavedPlacePreview,
  useSavedPlaces,
} from '@/lib/saved-places';
import { supabase } from '@/lib/supabase';
import { errMsg, haversineKm } from '@/lib/utils';

const SWIPE_THRESHOLD = 64;
const SWIPE_VELOCITY = 800; // px/s — RNGH velocity is px/s, not px/ms
const EXIT_MS = 280;
const TUTORIAL_KEY = 'mesita_swipe_tutorial_seen';
const TUTORIAL_AUTO_DISMISS_MS = 5500;
const SCREEN_W = Dimensions.get('window').width;

type Coords = { lat: number; lng: number };

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
  const [showTutorial, setShowTutorial] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const { isSaved, setSaved } = useSavedPlaces();

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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const seen = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (cancelled || seen) return;
      setShowTutorial(true);
      timer = setTimeout(() => {
        setShowTutorial(false);
        void AsyncStorage.setItem(TUTORIAL_KEY, '1');
      }, TUTORIAL_AUTO_DISMISS_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

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

  const dismissTutorial = useCallback(() => {
    setShowTutorial((was) => {
      if (was) void AsyncStorage.setItem(TUTORIAL_KEY, '1');
      return false;
    });
  }, []);

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

  const skipBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-80, -30, 0],
      [1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [-80, -30, 0],
          [1, 1, 0.9],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const saveBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 30, 80],
      [0, 1, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, 30, 80],
          [0.9, 1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

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

            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  zIndex: 30,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: '#fff',
                  backgroundColor: 'rgba(38,4,9,0.4)',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                },
                skipBadgeStyle,
              ]}
              pointerEvents="none"
            >
              <Text className="text-[11px] font-bold tracking-wider text-white uppercase">
                Skip
              </Text>
            </Animated.View>

            <Animated.View
              style={[{ position: 'absolute', top: 16, right: 16, zIndex: 30 }, saveBadgeStyle]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text className="text-[11px] font-bold tracking-wider text-white uppercase">
                  Save
                </Text>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {stamp === 'right' ? (
          <View
            className="absolute inset-0 z-40 items-center justify-center"
            pointerEvents="none"
          >
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 16,
                  borderWidth: 3,
                  borderColor: '#fff',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  transform: [{ rotate: '-8deg' }],
                },
                SHADOW_GLOW,
              ]}
            >
              <Heart color="#fff" fill="#fff" size={24} />
              <Text className="text-2xl font-black tracking-[0.15em] text-white uppercase">
                Saved
              </Text>
            </LinearGradient>
          </View>
        ) : null}

        {stamp === 'left' ? (
          <View
            className="absolute inset-0 z-40 items-center justify-center"
            pointerEvents="none"
          >
            <View className="flex-row items-center gap-2 rounded-2xl border-[3px] border-foreground/70 bg-foreground/85 px-5 py-2.5"
              style={{ transform: [{ rotate: '8deg' }] }}
            >
              <X color="#fff7f8" size={24} strokeWidth={3} />
              <Text className="text-2xl font-black tracking-[0.15em] text-background uppercase">
                Skip
              </Text>
            </View>
          </View>
        ) : null}

        {showTutorial ? (
          <View
            className="absolute inset-0 z-50 items-center justify-center bg-black/45"
            pointerEvents="none"
          >
            <View className="items-center gap-5">
              <Hand color="#fff" size={80} strokeWidth={1.4} />
              <Text className="text-center text-[13px] font-medium tracking-wide text-white/95">
                Swipe left to skip · right to save
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center gap-1.5">
        <ActionBtn
          label="Filter"
          Icon={SlidersHorizontal}
          onPress={() => setFiltersOpen(true)}
        />
        <ActionBtn label="Skip" Icon={X} onPress={() => beginExit('left')} />
        <ActionBtn
          label="Info"
          Icon={Store}
          onPress={() => router.push(`/place/${v.id}`)}
        />
        <ActionBtn
          label={saved ? 'Saved' : 'Save'}
          Icon={Heart}
          onPress={() => beginExit('right')}
          primary={saved}
          filled={saved}
        />
        <ActionBtn
          label="Reserve"
          Icon={CalendarCheck}
          onPress={() => undefined}
          disabled
        />
      </View>

      <FiltersComingSoonSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

function ActionBtn({
  label,
  Icon,
  onPress,
  disabled,
  primary,
  filled,
}: {
  label: string;
  Icon: typeof X;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
  filled?: boolean;
}) {
  if (primary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="h-12 flex-1 active:opacity-90"
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 8,
            },
            SHADOW_GLOW,
          ]}
        >
          <Icon color="#fff" size={16} fill={filled ? '#fff' : 'transparent'} />
          <Text className="text-xs font-semibold text-white">{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border ${
        disabled ? 'bg-muted/40' : 'bg-card active:bg-muted'
      }`}
    >
      <Icon
        color={disabled ? '#77525499' : '#775254'}
        size={16}
        fill={filled ? '#fb2b7b' : 'transparent'}
      />
      <Text
        className={`text-xs font-medium ${disabled ? 'text-muted-foreground/70' : 'text-foreground/70'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
  actionIcon: ActionIcon,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionIcon?: typeof RotateCcw;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <View className="size-14 items-center justify-center rounded-2xl bg-muted">
        <Compass color="#775254" size={24} />
      </View>
      <Text className="text-center font-display text-2xl font-semibold text-foreground">
        {title}
      </Text>
      <Text className="max-w-xs text-center text-sm text-muted-foreground">
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled}
          className="mt-2 flex-row items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 active:opacity-90 disabled:opacity-70"
        >
          {ActionIcon ? <ActionIcon color="#fff7f8" size={16} /> : null}
          <Text className="text-sm font-semibold text-background">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function sortPartnersFirst(input: Place[]): Place[] {
  return [...input].sort((a, b) => {
    const aRank = a.listing_type === 'partner' ? 0 : 1;
    const bRank = b.listing_type === 'partner' ? 0 : 1;
    return aRank - bRank;
  });
}

function shuffleDeck(input: Place[]): Place[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function withUserDistance(place: Place, coords: Coords | null): Place {
  if (coords) {
    const lat = toCoord(place.lat);
    const lng = toCoord(place.lng);
    if (lat != null && lng != null) {
      const km = haversineKm(coords.lat, coords.lng, lat, lng);
      const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
      return { ...place, distance_km: Math.max(rounded, 0.1) };
    }
  }
  return place.distance_km != null ? place : { ...place, distance_km: 0 };
}

function toCoord(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
