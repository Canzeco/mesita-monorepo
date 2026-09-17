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
import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import { resolveZoneLabel } from '@/lib/adapters/place-to-detail';
import type { Place } from '@/lib/api/places';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import { enrichPlaceOverview } from '@/lib/place-overview';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStateLabel } from '@/lib/place-state';
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
  const stateLabel = getOpeningStateLabel(place);
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

  return (
    <View className="absolute inset-0 overflow-hidden rounded-2xl bg-card">
      <CardPhotos photos={place.photos} name={place.name} />

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
          {/* decision: MESITA-933 — ink ✓ disc only when Mesita partner.
              Unverified: no disc; "Not Verified" tag in the chip row.
              MESITA-1954: the disc was a sky blue nobody names (bg-[#0EA5E9]);
              partner is a status, not a tier, so it takes the ink token —
              the same call web's SwipeCardInfo made (PartnerMark text-primary).
              Presence/absence still separates the two states; the white ✓
              carries the disc where the photo scrim is darkest. */}
          {isVerified ? (
            <View
              className="size-[18px] items-center justify-center rounded-full bg-primary"
              accessibilityLabel="Mesita Partner"
            >
              <Text className="text-[10px] font-bold text-white">✓</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap items-center gap-1.5">
          {/* decision: Pato — newly created / still-enriching places show the
              Enriching chip on the swipe deck too (web SwipeCardInfo parity).
              MESITA-1954: it was emerald. Greyscaled it would have BECOME
              MetaChip, so the in-flight state is carried by the spinner plus a
              DASHED border — the "not settled yet" vocabulary — never by tone. */}
          {place.is_enriching ? (
            <View
              className="flex-row items-center gap-1.5 rounded-md border border-dashed border-white/55 bg-black/45 px-[9px] py-[3px]"
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator color="#ffffff" size="small" />
              <Text className="text-[11px] font-semibold text-white">
                Enriching
              </Text>
            </View>
          ) : null}
          {!isVerified ? (
            <View className="flex-row items-center rounded-md border border-white/15 bg-black px-[9px] py-[3px]">
              <Text className="text-[11px] font-semibold text-white/70">
                Not Verified
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
              <Star color="#ffffff" fill="#ffffff" size={12} />
              {ratingCountLabel ? (
                <Text className="text-[11px] text-white/70">
                  ({ratingCountLabel})
                </Text>
              ) : null}
            </MetaChip>
          ) : null}
          {igFollowersLabel ? (
            <MetaChip>
              <ChannelMark channel="instagram" color="rgba(255,255,255,0.8)" size={12} />
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
          {stateLabel ? (
            <MetaChip>
              {/* MESITA-1954: open vs closed was emerald vs 70% white — hue
                  alone, and both greyscale to the same light tone on a photo.
                  Open is now a FILLED clock at full white, closed a hollow one
                  dimmed with its label: shape + weight, never two greys.
                  (getOpeningStateLabel can return "Until 23:00" with no
                  open/closed word, so the text cannot carry this by itself.) */}
              <Clock
                color={isOpen ? '#ffffff' : 'rgba(255,255,255,0.7)'}
                fill={isOpen ? 'rgba(255,255,255,0.4)' : 'transparent'}
                size={12}
              />
              <Text
                className={`text-[11px] font-semibold ${isOpen ? 'text-white' : 'text-white/75'}`}
              >
                {stateLabel}
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
              {/* FILLED glyph, matching PromoChip's affirmative exactly — the
                  inline copy here must not drift from the component the
                  Favorites tile renders. Opaque + border-less + filled is the
                  trio that keeps a discount unmissable now the ramp is ink. */}
              <Gift
                color={COLORS.primaryForeground}
                fill="rgba(255,255,255,0.4)"
                size={12}
              />
              <Text className="text-[11.5px] font-semibold text-white">
                Up to {promoPercent}% Discount for You
              </Text>
            </LinearGradient>
          ) : isVerified ? (
            <MetaChip>
              {/* The discount chip above is the only OPAQUE ink chip on the
                  card (GRADIENTS.pink is the ink ramp now) — the affirmative.
                  This one stays an outlined MetaChip and its glyph drops to the
                  0.7 white its siblings wear, so "no reward" reads as a state
                  nobody acts on rather than a second offer. */}
              <Gift color="rgba(255,255,255,0.7)" size={12} />
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
