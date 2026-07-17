import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { formatPlacePriceLevelSymbols } from '@/lib/place-price';
import { getOpeningStatusLabel } from '@/lib/place-status';
import {
  firstInitial,
  formatKm,
  formatRating,
} from '@/lib/utils';

export function RailCard({
  place,
  selected,
  onPress,
}: {
  place: Place;
  selected: boolean;
  onPress: () => void;
}) {
  const photo = place.photos[0];
  const rating = formatRating(place.google_rating);
  const price = formatPlacePriceLevelSymbols(place.price_level);
  const opening = getOpeningStatusLabel(place);
  const distance =
    place.distance_km != null && place.distance_km > 0
      ? formatKm(place.distance_km)
      : null;

  return (
    <Pressable
      onPress={onPress}
      className={`w-56 overflow-hidden rounded-2xl border bg-card ${
        selected ? 'border-primary' : 'border-border'
      }`}
      style={SHADOW_ELEV}
    >
      <View className="h-28 bg-muted">
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text className="font-display text-2xl font-bold text-white/85">
              {firstInitial(place.name)}
            </Text>
          </LinearGradient>
        )}
      </View>
      <View className="gap-0.5 p-2.5">
        <Text
          className="font-display text-[14px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          {rating ? (
            <View className="flex-row items-center gap-0.5">
              <Star color="#f59e0b" fill="#f59e0b" size={11} />
              <Text className="text-[11px] font-medium text-foreground">
                {rating}
              </Text>
            </View>
          ) : null}
          {price ? (
            <Text className="text-[11px] text-muted-foreground">{price}</Text>
          ) : null}
          {distance ? (
            <Text className="text-[11px] text-muted-foreground">{distance}</Text>
          ) : null}
        </View>
        {opening ? (
          <Text
            className={`text-[10px] ${
              place.open_now === true
                ? 'text-emerald-600'
                : 'text-muted-foreground'
            }`}
            numberOfLines={1}
          >
            {opening}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
