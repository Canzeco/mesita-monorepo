import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  Gift,
  MapPin,
  Navigation,
  Star,
  Users,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import { resolveZoneLabel } from '@/lib/adapters/place-to-detail';
import type { Place } from '@/lib/api/places';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import { enrichPlaceOverview } from '@/lib/place-overview';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import {
  firstInitial,
  formatCompactCount,
  formatRating,
} from '@/lib/utils';

export function PlaceSwipeCard({ place: rawPlace }: { place: Place }) {
  // Overview enrichment (MESITA parity) — derives google_rating / review count
  // / IG followers / open-closed / zone from the raw public-places columns that
  // ride along on every row, so the card's chips show REAL data (same mapper
  // the detail modal and Favorites use). Pure + presentational.
  const place = enrichPlaceOverview(rawPlace);

  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const ratingLabel = formatRating(place.google_rating);
  const ratingCountLabel =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const igFollowersLabel =
    place.instagram_followers_count != null
      ? formatCompactCount(place.instagram_followers_count)
      : null;
  const distanceLabel =
    place.distance_km == null || place.distance_km <= 0
      ? '- km'
      : `${place.distance_km} km`;
  const zoneLabel = resolveZoneLabel({
    zone: place.zone,
    address: place.address,
  });
  const categoryLabel = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const statusLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const isVerified = place.listing_type === 'partner';
  const isFirstVisit = place.is_first_visit !== false;
  const promoPercent =
    isVerified
      ? resolvePromoRateFromPlaceRow(
          place as unknown as Record<string, unknown>,
          isFirstVisit,
          false,
        )
      : null;

  const scoreLabel = formatLaneScore(place.score);

  return (
    <View className="absolute inset-0 overflow-hidden rounded-2xl bg-card">
      <CardPhotos photos={place.photos} name={place.name} />

      {/* Top-left lane score — symmetrical with the photo counter (top-right). */}
      {scoreLabel ? (
        <View
          className="absolute top-3 left-3 z-10 rounded-full bg-black/60 px-2 py-0.5"
          pointerEvents="none"
          accessibilityLabel={`Score ${scoreLabel}`}
        >
          <Text className="text-[10px] font-semibold text-white">
            {scoreLabel}
          </Text>
        </View>
      ) : null}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
        locations={[0.35, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
        pointerEvents="none"
      />

      <View
        className="absolute right-0 bottom-0 left-0 gap-2 p-4 pt-3"
        pointerEvents="none"
      >
        <View className="flex-row items-center gap-1.5">
          <Text
            className="min-w-0 flex-1 text-[1.7rem] leading-[1.15] font-semibold tracking-tight text-white"
            numberOfLines={2}
            style={{ textShadowColor: 'rgba(0,0,0,0.62)', textShadowRadius: 12 }}
          >
            {place.name}
          </Text>
          {/* decision: Pato — always a disc beside the name: blue ✓ partner,
              muted slate ? not verified (pair to web verified-check /
              unverified-mark). Not amber — reads as warning (MESITA-928). */}
          <View
            className={`size-[18px] items-center justify-center rounded-full ${
              isVerified ? 'bg-[#0EA5E9]' : 'bg-[#94A3B8]'
            }`}
            accessibilityLabel={isVerified ? 'Verified Partner' : 'Not verified'}
          >
            <Text className="text-[10px] font-bold text-white">
              {isVerified ? '✓' : '?'}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-1.5">
          {/* decision: Pato — newly created / still-enriching places show the
              Enriching chip on the swipe deck too (web SwipeCardInfo parity). */}
          {place.is_enriching ? (
            <View
              className="flex-row items-center gap-1.5 rounded-md border border-emerald-300/55 bg-emerald-500/35 px-[9px] py-[3px]"
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator color="#ecfdf5" size="small" />
              <Text className="text-[11px] font-semibold text-emerald-50">
                Enriching
              </Text>
            </View>
          ) : null}
          {categoryLabel ? <MetaChip label={categoryLabel} /> : null}
          {priceLabel ? <MetaChip label={priceLabel} /> : null}
          {ratingLabel ? (
            <MetaChip>
              <Text className="text-[11px] font-semibold text-white">
                {ratingLabel}
              </Text>
              <Star color="#fbbf24" fill="#fbbf24" size={12} />
              {ratingCountLabel ? (
                <Text className="text-[11px] text-white/70">
                  ({ratingCountLabel})
                </Text>
              ) : null}
            </MetaChip>
          ) : null}
          {igFollowersLabel ? (
            <MetaChip>
              <ChannelMark channel="instagram" color="rgba(251,207,232,0.8)" size={12} />
              <Text className="text-[11px] font-semibold text-white">
                {igFollowersLabel}
              </Text>
              <Users color="rgba(255,255,255,0.7)" size={12} />
            </MetaChip>
          ) : null}
          <MetaChip>
            <Navigation color="rgba(255,255,255,0.7)" size={12} />
            <Text className="text-[11px] font-semibold text-white">
              {distanceLabel}
            </Text>
          </MetaChip>
          <MetaChip>
            <MapPin color="rgba(255,255,255,0.7)" size={12} />
            <Text
              className={`max-w-[160px] text-[11px] font-semibold ${zoneLabel ? 'text-white' : 'text-white/75'}`}
              numberOfLines={1}
            >
              {zoneLabel ?? 'Neighborhood'}
            </Text>
          </MetaChip>
          {statusLabel ? (
            <MetaChip>
              <Clock
                color={isOpen ? '#34d399' : 'rgba(255,255,255,0.7)'}
                size={12}
              />
              <Text className="text-[11px] font-semibold text-white">
                {statusLabel}
              </Text>
            </MetaChip>
          ) : null}
          {promoPercent != null ? (
            <LinearGradient
              colors={[...GRADIENTS.pink]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Gift color="#fff" size={12} />
              <Text className="text-[11.5px] font-semibold text-white">
                Up to {promoPercent}% Discount for You
              </Text>
            </LinearGradient>
          ) : isVerified ? (
            <MetaChip>
              <Gift color="#fff" size={12} />
              <Text className="text-[11px] font-semibold text-white">
                No Reward for You
              </Text>
            </MetaChip>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// In-card photo carousel — RN port of the web PlaceSwipeCardFace + ImageCarousel
// interaction: because the card itself is the horizontal swipe surface, photos
// PAGE via left/right tap zones (never a nested horizontal scroll, which would
// fight the outer swipe gesture — same reason web uses noNativeScroll + tap
// zones). expo-image crossfades between sources on `source` change, so tapping
// pages through every photo with a soft transition. Pill dots + a counter mirror
// the web chrome.
function CardPhotos({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const count = photos.length;
  const active = photos[Math.min(idx, Math.max(count - 1, 0))];

  const page = useCallback(
    (dir: 1 | -1) => {
      setIdx((i) => ((i + dir) % count + count) % count);
    },
    [count],
  );

  if (count === 0) {
    return (
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      >
        <View className="flex-1 items-center justify-center">
          <Text className="font-display text-7xl font-bold text-white/70">
            {firstInitial(name)}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <>
      <Image
        source={{ uri: active }}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
        transition={220}
      />

      {count > 1 ? (
        <>
          {/* Left / right tap zones — page photos. The deck's pan gesture uses
              activeOffsetX, so a tap (no horizontal travel) falls through to
              these Pressables while a real drag still swipes the card. */}
          <Pressable
            onPress={() => page(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            className="absolute top-0 bottom-0 left-0 w-1/3"
          />
          <Pressable
            onPress={() => page(1)}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            className="absolute top-0 right-0 bottom-0 w-1/3"
          />

          {/* Pill dots */}
          <View
            className="absolute inset-x-0 top-3 flex-row justify-center gap-1.5"
            pointerEvents="none"
          >
            {photos.map((src, i) => (
              <View
                key={src}
                className={`h-1.5 rounded-full bg-white ${
                  i === idx ? 'w-5 opacity-100' : 'w-1.5 opacity-60'
                }`}
              />
            ))}
          </View>

          {/* Slide counter */}
          <View
            className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5"
            pointerEvents="none"
          >
            <Text className="text-[10px] font-semibold text-white">
              {idx + 1} / {count}
            </Text>
          </View>
        </>
      ) : null}
    </>
  );
}

/** Lineup playground parity — three decimal places on the 0–1 lane score. */
function formatLaneScore(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  return score.toFixed(3);
}

function MetaChip({
  children,
  label,
}: {
  children?: ReactNode;
  label?: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-md border border-white/35 bg-black/45 px-2.5 py-1">
      {label ? (
        <Text className="text-[11px] font-semibold text-white">{label}</Text>
      ) : (
        children
      )}
    </View>
  );
}
