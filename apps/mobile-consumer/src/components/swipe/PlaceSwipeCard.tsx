import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, MapPin, Navigation, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import {
  firstInitial,
  formatCompactCount,
  formatRating,
} from '@/lib/utils';

export function PlaceSwipeCard({ place }: { place: Place }) {
  const photo = place.photos[0];
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const ratingLabel = formatRating(place.google_rating);
  const ratingCountLabel =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const distanceLabel =
    place.distance_km == null || place.distance_km <= 0
      ? '- km'
      : `${place.distance_km} km`;
  const zoneLabel = place.zone?.trim() || null;
  const categoryLabel =
    place.category_label?.trim() || place.category?.trim() || null;
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

  return (
    <View className="absolute inset-0 overflow-hidden rounded-2xl bg-card">
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        >
          <View className="flex-1 items-center justify-center">
            <Text className="font-display text-7xl font-bold text-white/70">
              {firstInitial(place.name)}
            </Text>
          </View>
        </LinearGradient>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
        locations={[0.35, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
      />

      <View className="absolute right-0 bottom-0 left-0 gap-2 p-4 pt-3">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="min-w-0 flex-1 text-[1.7rem] leading-[1.15] font-semibold tracking-tight text-white"
            numberOfLines={2}
            style={{ textShadowColor: 'rgba(0,0,0,0.62)', textShadowRadius: 12 }}
          >
            {place.name}
          </Text>
          {isVerified ? (
            <View className="size-[18px] items-center justify-center rounded-full bg-[#3897f0]">
              <Text className="text-[10px] font-bold text-white">✓</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap items-center gap-1.5">
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
                {promoPercent}% OFF{' '}
                {isFirstVisit ? 'welcome' : 'return-visit'} discount
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
