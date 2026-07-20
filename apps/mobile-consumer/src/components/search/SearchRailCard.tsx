import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Star } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import {
  COLORS,
  GRADIENT_DIAGONAL,
  GRADIENTS,
  SHADOW_ELEV,
} from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { resolvePlaceCategoryName } from '@/lib/place-category';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { firstInitial, formatKm, formatRating } from '@/lib/utils';

/** Horizontal catalog card — mirrors web SearchRailCard / PlaceCatalog language. */
export function RailCard({
  place,
  selected,
  onSelect,
  onOpen,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const photo = place.photos[0];
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const subtitle = [category, place.zone].filter(Boolean).join(' · ');
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const priceSymbols = formatPlacePriceLevelSymbols(place.price_level);
  const rating = formatRating(place.google_rating);
  const distance =
    place.distance_km != null ? formatKm(place.distance_km) : null;
  const hasMeta = rating != null || priceSymbols != null || distance != null;
  const a11y = [
    place.name,
    subtitle || null,
    rating ? `Rated ${rating}` : null,
    priceSymbols,
    distance,
    openingLabel,
    selected ? 'Selected' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={selected ? onOpen : onSelect}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      className={`w-[288px] flex-row items-center gap-3 rounded-2xl border bg-card/95 p-2 ${
        selected ? 'border-primary' : 'border-border'
      }`}
      style={[
        SHADOW_ELEV,
        selected
          ? {
              borderWidth: 2,
              borderColor: COLORS.primary,
              shadowColor: COLORS.primary,
              shadowOpacity: 0.25,
            }
          : null,
      ]}
    >
      <View className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-lg font-bold text-white">
              {firstInitial(place.name)}
            </Text>
          </LinearGradient>
        )}
      </View>

      <View className="min-w-0 flex-1 justify-center gap-1 py-0.5">
        <View className="flex-row items-center gap-1">
          <Text
            className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground"
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {place.listing_type === 'partner' ? (
            <BadgeCheck
              color={COLORS.primary}
              size={14}
              accessibilityLabel="Verified Partner"
            />
          ) : null}
        </View>

        {subtitle ? (
          <Text
            className="text-[11px] leading-4 text-muted-foreground"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}

        {hasMeta ? (
          <View className="flex-row flex-wrap items-center gap-1">
            {rating ? (
              <View className="flex-row items-center gap-0.5">
                <Star color="#f59e0b" fill="#f59e0b" size={10} />
                <Text className="text-[11px] leading-4 text-muted-foreground">
                  {rating}
                </Text>
              </View>
            ) : null}
            {priceSymbols ? (
              <Text className="text-[11px] leading-4 text-muted-foreground">
                {rating ? '· ' : ''}
                {priceSymbols}
              </Text>
            ) : null}
            {distance ? (
              <Text className="text-[11px] leading-4 text-muted-foreground">
                {rating || priceSymbols ? '· ' : ''}
                {distance}
              </Text>
            ) : null}
          </View>
        ) : null}

        {openingLabel ? (
          <View className="flex-row items-center gap-1.5">
            <View
              className={`h-1.5 w-1.5 rounded-full ${
                isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'
              }`}
            />
            <Text
              className={`text-[11px] font-medium leading-4 ${
                isOpen ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
              numberOfLines={1}
            >
              {openingLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
