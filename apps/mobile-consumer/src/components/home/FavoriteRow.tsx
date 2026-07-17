import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Gift, Heart, Navigation } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import { firstInitial } from '@/lib/utils';

export function FavoriteRow({
  place,
  onRemove,
}: {
  place: Place;
  onRemove: () => void;
}) {
  const router = useRouter();
  const photo = place.photos[0];
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? `${place.distance_km} km`
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(' · ');
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const isPartner = place.listing_type === 'partner';
  const promoPercent = isPartner
    ? resolvePromoRateFromPlaceRow(
        place as unknown as Record<string, unknown>,
        place.is_first_visit !== false,
        false,
      )
    : null;

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center gap-3"
        onPress={() => router.push(`/place/${place.id}`)}
      >
        <View className="size-16 overflow-hidden rounded-xl bg-muted">
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
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="font-display text-xl font-bold text-white/85">
                {firstInitial(place.name)}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="font-display text-[15px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {subtitle ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Navigation color="#775254" size={12} />
              <Text
                className="flex-1 text-xs text-muted-foreground"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          ) : null}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {openingLabel ? (
              <View className="flex-row items-center gap-1">
                <View
                  className={`size-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                />
                <Text
                  className={`text-[11px] font-medium ${isOpen ? 'text-emerald-600' : 'text-muted-foreground'}`}
                >
                  {openingLabel}
                </Text>
              </View>
            ) : null}
            {promoPercent != null ? (
              <View className="flex-row items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5">
                <Gift color="#fb2b7b" size={10} />
                <Text className="text-[10.5px] font-semibold text-primary">
                  {promoPercent}% OFF
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={onRemove}
        accessibilityLabel={`Remove ${place.name} from saved`}
        className="size-8 items-center justify-center rounded-full bg-rose-500/10 active:scale-90"
      >
        <Heart color="#f43f5e" fill="#f43f5e" size={16} />
      </Pressable>
    </View>
  );
}
