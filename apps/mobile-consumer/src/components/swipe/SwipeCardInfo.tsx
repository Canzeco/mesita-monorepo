import {
  Camera,
  Clock,
  MapPin,
  Navigation,
  Star,
  Users,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { PromoChip } from '@/components/swipe/PromoChip';
import { resolveZoneLabel } from '@/lib/adapters/place-to-detail';
import type { Place } from '@/lib/api/places';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import {
  formatCompactCount,
  formatRating,
} from '@/lib/utils';

/** Place fields — padding comes from SWIPE_CARD_FIELDS_INNER on the card face. */
export function SwipeCardInfo({
  place,
  compact = false,
}: {
  place: Place;
  compact?: boolean;
}) {
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const ratingLabel = formatRating(place.google_rating);
  const ratingCountLabel =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const distanceLabel =
    place.distance_km == null || place.distance_km <= 0
      ? '- km'
      : `${place.distance_km} km`;
  const zoneLabel = resolveZoneLabel({
    zone: place.zone,
    address: place.address,
  });
  const zoneDisplay = zoneLabel ?? 'Neighborhood';
  const categoryLabel = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const igFollowersLabel =
    place.instagram_followers_count != null
      ? formatCompactCount(place.instagram_followers_count)
      : null;
  const statusLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const isVerified = place.listing_type === 'partner';
  const titleSize = compact ? 'text-[1.3rem]' : 'text-[1.95rem]';

  return (
    <View className={`flex-col ${compact ? 'gap-1.5' : 'gap-2.5 p-4 pt-3'}`}>
      <View className="min-w-0 flex-row items-center gap-1.5">
        <Text
          className={`min-w-0 flex-1 font-semibold tracking-tight text-white ${titleSize}`}
          numberOfLines={compact ? 1 : 2}
          style={{
            lineHeight: compact ? 24 : 32,
            textShadowColor: 'rgba(0,0,0,0.62)',
            textShadowRadius: 12,
          }}
        >
          {place.name}
        </Text>
        {isVerified ? (
          <View
            accessibilityLabel="Verified Partner"
            className="size-[18px] items-center justify-center rounded-full bg-[#3897f0]"
          >
            <Text className="text-[10px] font-bold text-white">✓</Text>
          </View>
        ) : null}
      </View>

      <View
        className={`flex-row flex-wrap items-center gap-1.5 ${
          compact ? 'max-h-[102px] overflow-hidden' : ''
        }`}
      >
        {categoryLabel ? (
          <MetaChip compact={compact}>
            <Text className="text-[11px] font-semibold text-white">
              {categoryLabel}
            </Text>
          </MetaChip>
        ) : null}
        {priceLabel ? (
          <MetaChip compact={compact}>
            <Text className="text-[11px] font-semibold text-white">
              {priceLabel}
            </Text>
          </MetaChip>
        ) : null}
        {ratingLabel ? (
          <MetaChip compact={compact}>
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
          <MetaChip compact={compact}>
            <Camera color="rgba(251,207,232,0.8)" size={12} />
            <Text className="text-[11px] font-semibold text-white">
              {igFollowersLabel}
            </Text>
            <Users color="rgba(255,255,255,0.7)" size={12} />
          </MetaChip>
        ) : null}
        <MetaChip compact={compact}>
          <Navigation color="rgba(255,255,255,0.7)" size={12} />
          <Text className="text-[11px] font-semibold text-white">
            {distanceLabel}
          </Text>
        </MetaChip>
        <MetaChip compact={compact}>
          <MapPin color="rgba(255,255,255,0.7)" size={12} />
          <Text
            className={`max-w-[180px] text-[11px] font-semibold ${
              zoneLabel ? 'text-white' : 'text-white/75'
            }`}
            numberOfLines={1}
          >
            {zoneDisplay}
          </Text>
        </MetaChip>
        {statusLabel ? (
          <MetaChip compact={compact}>
            <Clock
              color={isOpen ? '#34d399' : 'rgba(255,255,255,0.7)'}
              size={12}
            />
            <Text className="text-[11px] font-semibold text-white">
              {statusLabel}
            </Text>
          </MetaChip>
        ) : null}
        <PromoChip place={place} size="md" showWhenEmpty />
      </View>
    </View>
  );
}

function MetaChip({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-md border border-white/35 bg-black/45 ${
        compact ? 'px-[9px] py-[3px]' : 'px-2.5 py-1'
      }`}
    >
      {children}
    </View>
  );
}
