import {
  Clock,
  Globe,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { PartnerMark } from '@/components/brand/PartnerMark';
import { COLORS } from '@/constants/brand';
import { formatPlacePriceChip } from '@/lib/place-price';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { formatCompactCount, formatDistanceKm, formatRating } from '@/lib/utils';

import { ProfileActions } from './ProfileActions';
import {
  ProfileMetaChip,
  ProfilePhoto,
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
  const fbFollowers = formatCompactCount(place.facebook.followers, false);
  const priceLabel = formatPlacePriceChip({
    priceRange: place.price_range,
    priceLevel: place.price_level,
    currency: place.currency,
  });
  const stateValue = place.open_now
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
          <ProfileStat
            value={fbFollowers}
            label="Facebook"
            fb
          />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {place.is_enriching ? (
          // Greyed in place this chip becomes byte-identical to the neutral
          // ProfileMetaChips beside it ('Polanco', '1.2 km') — a transient system
          // state reading as a fact about the place. It is the row's one "not
          // here yet", so it takes the DASHED hairline and the lighter card fill
          // while its neighbours stay solid-bordered and filled; the spinner's
          // MOTION, which no repaint can take, stays the strongest tell.
          <View className="flex-row items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2.5 py-1">
            <ActivityIndicator color={COLORS.foreground} size="small" />
            <Text className="text-[11.5px] font-semibold text-foreground">
              Enriching
            </Text>
          </View>
        ) : null}
        <ProfileMetaChip>
          {isPartner ? (
            <>
              {/* Was lucide BadgeCheck with fill and stroke both #0ea5e9 —
                  the check vanished into the blob (MESITA-2031). The chip
                  already says "Mesita Partner", so the mark is decorative. */}
              <PartnerMark size={14} label={null} />
              <Text className="text-[11.5px] font-semibold text-foreground">
                Mesita Partner
              </Text>
            </>
          ) : (
            <>
              <Globe color={COLORS.mutedForeground} size={14} />
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
          <MapPin color={COLORS.mutedForeground} size={12} />
          <Text
            className="max-w-[160px] text-[11.5px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.zone || '—'}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Navigation color={COLORS.mutedForeground} size={12} />
          <Text className="text-[11.5px] font-semibold text-foreground">
            {formatDistanceKm(place.distance_km)}
          </Text>
        </ProfileMetaChip>
        <ProfileMetaChip>
          {/* Open/closed was carried three ways and two of them INVERTED: the
              label was emerald-700 when open but near-black foreground when
              closed, so a blanket greyscale would have rendered CLOSED as the
              heavier of the two. One idiom for the whole app now, the one
              HoursBox took in hours-location.tsx — open = ink + bold, closed =
              muted + medium — on top of the word the chip already says. */}
          <Clock
            color={place.open_now ? COLORS.foreground : COLORS.mutedForeground}
            size={12}
          />
          <Text
            className={`text-[11.5px] ${
              place.open_now
                ? 'font-bold text-foreground'
                : 'font-medium text-muted-foreground'
            }`}
          >
            {stateValue}
          </Text>
        </ProfileMetaChip>
        <PromoMetaChip place={place} />
      </View>

      <ProfileActions place={place} onSaveToggle={onSaveToggle} />
    </View>
  );
}
