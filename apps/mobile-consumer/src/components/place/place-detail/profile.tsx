import {
  BadgeCheck,
  Clock,
  Globe,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { formatPlacePriceChip } from '@/lib/place-price';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { formatCompactCount, formatDistanceKm, formatRating } from '@/lib/utils';

import { ProfileActions } from './ProfileActions';
import {
  ProfileMetaChip,
  ProfilePhoto,
  ProfileRewardStat,
  ProfileStat,
  PromoMetaChip,
} from './profile-summary-parts';

export function ProfileSummary({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const googleRating = formatRating(place.google.rating) ?? '—';
  const googleCount = formatCompactCount(place.google.count, false);
  const igFollowers = formatCompactCount(place.instagram.followers, false);
  const priceLabel = formatPlacePriceChip({
    priceRange: place.price_range,
    priceLevel: place.price_level,
    currency: place.currency,
  });
  const statusValue = place.open_now
    ? `Open · until ${place.closes_at || '—'}`
    : `Closed · opens ${place.opens_at || '—'}`;
  const isPartner = place.listing_type === 'partner';

  return (
    <View className="gap-3 border-b border-border bg-card px-4 pt-3 pb-4">
      <View className="flex-row items-center gap-4">
        <ProfilePhoto place={place} />
        <View className="min-w-0 flex-1 flex-row">
          <ProfileStat
            value={googleRating}
            label={`${googleCount} Google`}
            star
          />
          <ProfileStat
            value={igFollowers}
            label="Instagram"
            ig
          />
          <ProfileRewardStat place={place} />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {place.is_enriching ? (
          <View className="flex-row items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2.5 py-1">
            <ActivityIndicator color="#059669" size="small" />
            <Text className="text-[11.5px] font-semibold text-emerald-900">
              Enriching
            </Text>
          </View>
        ) : null}
        <ProfileMetaChip>
          {isPartner ? (
            <>
              <BadgeCheck color="#0ea5e9" size={14} fill="#0ea5e9" />
              <Text className="text-[11.5px] font-semibold text-foreground">
                Verified Partner
              </Text>
            </>
          ) : (
            <>
              <Globe color="#775254" size={14} />
              <Text className="text-[11.5px] font-semibold text-foreground">
                Not Verified
              </Text>
            </>
          )}
        </ProfileMetaChip>
        {place.category ? (
          <ProfileMetaChip>
            <Text className="text-[11.5px] font-semibold text-foreground">
              {place.category}
            </Text>
          </ProfileMetaChip>
        ) : null}
        {priceLabel ? (
          <ProfileMetaChip>
            <Text className="text-[11.5px] font-semibold text-foreground">
              {priceLabel}
            </Text>
          </ProfileMetaChip>
        ) : null}
        <ProfileMetaChip>
          <MapPin color="#775254" size={12} />
          <Text
            className="max-w-[160px] text-[11.5px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.zone || '—'}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Navigation color="#775254" size={12} />
          <Text className="text-[11.5px] font-semibold text-foreground">
            {formatDistanceKm(place.distance_km)}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Clock
            color={place.open_now ? '#059669' : '#775254'}
            size={12}
          />
          <Text
            className={`text-[11.5px] font-semibold ${
              place.open_now ? 'text-emerald-700' : 'text-foreground'
            }`}
          >
            {statusValue}
          </Text>
        </ProfileMetaChip>
        <PromoMetaChip place={place} />
      </View>

      <ProfileActions place={place} onSaveToggle={onSaveToggle} />
    </View>
  );
}
