import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Heart, Navigation } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { PromoChip } from '@/components/swipe/PromoChip';
import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { placePath } from '@/lib/consumer-route-contract';
import { getOpeningStatusLabel } from '@/lib/place-status';
import { firstInitial } from '@/lib/utils';

// One place tile in the Favorites grid — mirror of web FavoriteTile.tsx.
//
// Replaces the old 64px-thumbnail row. A place is chosen by what the room looks
// like, so the photo is the content: a tile gives it roughly 8x the area at
// slightly better vertical density. Two columns is a DISCOVERY pattern — it
// belongs here and on nothing in the rewards tab, where a ticket is scanned for
// state, not browsed for looks.
//
// Every tile is the SAME size (Pato, 2026-08-10): a plain 2-column grid, no
// hero span on odd counts. An earlier pass gave the first tile a full-width
// 16:9 crop to avoid the trailing gap — that's out, the even rhythm wins.
export function FavoriteTile({
  place,
  saved,
  onToggle,
}: {
  place: Place;
  /** Filled heart (in your saves) vs outline (a suggestion you can save). */
  saved: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const photo = place.photos[0];
  // distance_km === 0 is the SwipeDeck's "couldn't calculate" placeholder —
  // treat it as unknown here so the tile never claims a fake 0 km.
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? `${place.distance_km} km`
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(' · ');
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable
        onPress={() => router.push(placePath(place.slug || place.id))}
        accessibilityLabel={`Open ${place.name}`}
        className="flex-1 active:opacity-90"
      >
        <View className="w-full bg-muted" style={{ aspectRatio: 3 / 4 }}>
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
              <Text className="font-display text-3xl font-bold text-white/85">
                {firstInitial(place.name)}
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* No fixed heights in here — at large Dynamic Type the tile grows a
            row instead of clipping one. */}
        <View className="min-w-0 flex-1 p-2.5">
          <Text
            className="font-display text-[15px] font-semibold tracking-tight text-foreground"
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {subtitle ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Navigation color={COLORS.mutedForeground} size={12} />
              <Text
                className="flex-1 text-[11.5px] text-muted-foreground"
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
            <PromoChip place={place} size="sm" />
          </View>
        </View>
      </Pressable>

      {/* 44pt hit area around a 32pt visual circle. The old row shipped a bare
          size-8 target — under every touch guideline, and putting it over a
          photo makes it worse. hitSlop buys the difference without growing the
          artwork. */}
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        accessibilityLabel={
          saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
        }
        className={`absolute right-2 top-2 size-8 items-center justify-center rounded-full active:scale-90 ${
          saved ? 'bg-white/90' : 'bg-black/35'
        }`}
      >
        <Heart
          color={saved ? '#f43f5e' : '#ffffff'}
          fill={saved ? '#f43f5e' : 'transparent'}
          size={16}
        />
      </Pressable>
    </View>
  );
}
