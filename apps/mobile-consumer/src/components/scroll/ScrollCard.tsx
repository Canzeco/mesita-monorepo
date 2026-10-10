import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Share2, Zap } from 'lucide-react-native';
import { memo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PartnerMark } from '@/components/brand/PartnerMark';
import { COLORS } from '@/constants/brand';
import { resolveZoneLabel } from '@/lib/adapters/place-to-detail';
import type { Place } from '@/lib/api/places';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStateLabel } from '@/lib/place-state';
import { formatCompactCount, formatDistanceKm, formatRating } from '@/lib/utils';

// One place, one screen — web's ScrollCard (MESITA-2105, design 1A), native.
//
// The photo fills the card; an action column sits on the right (avatar =
// Profile, Save, Share, Go as the one solid white disc); name and meta sit
// bottom-left over a scrim. Swipe sideways pages the photos, a double tap
// saves, a single tap does nothing (design 4A). Every disc is 48pt glass:
// white on 55% black holds 4.74:1 over a pure-white photo.
//
// Partner reads `place.partner`, the server's per-request fact — the same one
// web's card reads — never `listing_type`.
//
// What each action DOES is the feed's call (scrollCardActions in ScrollFeed):
// a mock card toasts and never reaches Favs, a place screen or a reservation.

const SHORT_FRAME = 520;

function ScrollCardImpl({
  place,
  index,
  total,
  width,
  height,
  saved,
  onProfile,
  onToggleSave,
  onShare,
  onGo,
}: {
  place: Place;
  index: number;
  total: number;
  width: number;
  height: number;
  saved: boolean;
  onProfile: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onGo: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [photoIdx, setPhotoIdx] = useState(0);
  const photosRef = useRef<FlatList<string>>(null);
  const burst = useSharedValue(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.get(),
    transform: [{ scale: 0.6 + burst.get() * 0.5 }],
  }));

  const onDoubleTap = () => {
    // Double tap only ever SAVES, the same as every feed that taught it.
    if (!saved) onToggleSave();
    if (reduceMotion) return;
    // `.set()`, not `.value =`: the React Compiler treats a hook's return as
    // immutable, and Reanimated 4's setter is the sanctioned way through.
    burst.set(
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(1, { duration: 380 }),
        withTiming(0, { duration: 280 }),
      ),
    );
  };
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .maxDistance(24)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) onDoubleTap();
    });

  const partner = place.partner === true;
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const price = formatPlacePriceLevelSymbols(place.price_level);
  const zone = resolveZoneLabel({ zone: place.zone, address: place.address });
  const distance =
    place.distance_km != null && place.distance_km > 0
      ? formatDistanceKm(place.distance_km)
      : null;
  const rating = formatRating(place.google_rating);
  const ratingCount =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const openState = getOpeningStateLabel(place);
  const metaLine = [category, price, zone, distance].filter(Boolean).join(' · ');
  const ratingLine = [
    rating ? `★ ${rating}${ratingCount ? ` (${ratingCount})` : ''}` : null,
    openState,
  ]
    .filter(Boolean)
    .join(' · ');
  const initial = place.name.trim().charAt(0).toUpperCase() || '·';
  const short = height < SHORT_FRAME;

  const onPhotosSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (i !== photoIdx) setPhotoIdx(i);
  };

  return (
    <View
      style={{ width, height }}
      className="overflow-hidden bg-foreground"
      accessible={false}
      accessibilityLabel={`${place.name}, ${index + 1} of ${total}`}
    >
      <GestureDetector gesture={doubleTap}>
        <View style={{ width, height }}>
          {place.photos.length > 0 ? (
            <FlatList
              ref={photosRef}
              data={place.photos}
              keyExtractor={(src, i) => `${src}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPhotosSettled}
              initialNumToRender={1}
              windowSize={3}
              getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
              renderItem={({ item, index: i }) => (
                <Slide
                  src={item}
                  width={width}
                  height={height}
                  initial={initial}
                  label={`${place.name}, photo ${i + 1} of ${place.photos.length}`}
                />
              )}
            />
          ) : (
            <Placeholder width={width} height={height} initial={initial} />
          )}
        </View>
      </GestureDetector>

      {place.photos.length > 1 && (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 top-0 h-11 flex-row items-center justify-center"
        >
          {place.photos.map((_src, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${place.name}, photo ${i + 1} of ${place.photos.length}`}
              accessibilityState={{ selected: i === photoIdx }}
              hitSlop={6}
              onPress={() => {
                photosRef.current?.scrollToIndex({ index: i, animated: true });
                setPhotoIdx(i);
              }}
              className="h-6 min-w-6 items-center justify-center"
            >
              <View
                style={{
                  height: 6,
                  width: i === photoIdx ? 20 : 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.onMedia,
                  opacity: i === photoIdx ? 1 : 0.6,
                }}
              />
            </Pressable>
          ))}
        </View>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.72)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.6 }}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: height / 2 - 56, left: width / 2 - 56 },
          burstStyle,
        ]}
      >
        <Heart size={112} color={COLORS.onMedia} fill={COLORS.onMedia} />
      </Animated.View>

      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 gap-1 p-4 pb-5"
        style={{ right: 72 }}
      >
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="shrink font-display text-2xl font-semibold text-on-media"
            style={{
              textShadowColor: 'rgba(0,0,0,0.62)',
              textShadowRadius: 12,
              textShadowOffset: { width: 0, height: 2 },
            }}
          >
            {place.name}
          </Text>
          {partner ? <PartnerMark size={20} /> : null}
        </View>
        {metaLine ? (
          <Text numberOfLines={1} className="text-sm font-medium text-on-media-muted">
            {metaLine}
          </Text>
        ) : null}
        {ratingLine ? (
          <Text numberOfLines={1} className="text-sm font-medium text-on-media-muted">
            {ratingLine}
          </Text>
        ) : null}
        {place.pitch && !short ? (
          <Text numberOfLines={2} className="text-sm leading-snug text-on-media-muted">
            {place.pitch}
          </Text>
        ) : null}
      </View>

      <View
        className="absolute right-3 bottom-5 items-center"
        style={{ gap: short ? 8 : 12 }}
      >
        <Action label="Profile" a11y={`Open ${place.name}`} onPress={onProfile}>
          <Text className="font-display text-lg font-semibold text-on-media">{initial}</Text>
        </Action>
        <Action
          label={saved ? 'Saved' : 'Save'}
          a11y={saved ? `Unsave ${place.name}` : `Save ${place.name}`}
          selected={saved}
          onPress={onToggleSave}
        >
          <Heart
            size={24}
            strokeWidth={2.1}
            color={COLORS.onMedia}
            fill={saved ? COLORS.onMedia : 'transparent'}
          />
        </Action>
        <Action label="Share" a11y={`Share ${place.name}`} onPress={onShare}>
          <Share2 size={24} strokeWidth={2.1} color={COLORS.onMedia} />
        </Action>
        <Action label="Go" a11y={`Go to ${place.name}`} onPress={onGo} inverted>
          <Zap size={24} strokeWidth={2.2} color={COLORS.foreground} />
        </Action>
      </View>
    </View>
  );
}

export const ScrollCard = memo(ScrollCardImpl);

function Action({
  label,
  a11y,
  selected,
  inverted = false,
  onPress,
  children,
}: {
  label: string;
  a11y: string;
  selected?: boolean;
  inverted?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      className="items-center gap-1 active:opacity-80"
    >
      <View
        className={`size-12 items-center justify-center rounded-full ${
          inverted ? 'bg-on-media' : 'bg-media-glass'
        }`}
      >
        {children}
      </View>
      <Text
        className="text-xs font-semibold text-on-media"
        style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// A dead photo URL becomes the same ink placeholder as a place with no
// photos, never a blank or broken frame.
function Slide({
  src,
  width,
  height,
  initial,
  label,
}: {
  src: string;
  width: number;
  height: number;
  initial: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Placeholder width={width} height={height} initial={initial} />;
  return (
    <Image
      source={{ uri: src }}
      style={{ width, height }}
      contentFit="cover"
      transition={150}
      accessibilityLabel={label}
      onError={() => setFailed(true)}
    />
  );
}

function Placeholder({
  width,
  height,
  initial,
}: {
  width: number;
  height: number;
  initial: string;
}) {
  return (
    <View style={{ width, height }} className="items-center justify-center bg-foreground">
      <Text className="font-display text-7xl font-semibold text-on-media-muted">{initial}</Text>
    </View>
  );
}
