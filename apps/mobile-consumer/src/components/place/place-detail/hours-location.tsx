import { LinearGradient } from 'expo-linear-gradient';
import { Bike, Clock, MapPin } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import { ImageCarousel } from '@/components/place/ImageCarousel';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { buildUberDropoffUrl } from '@/lib/uber-link';
import { formatDistanceKm } from '@/lib/utils';
import { Box } from './shared';

export function MediaBox({ place }: { place: PlaceDetail }) {
  if (place.photos.length === 0) return null;
  return (
    <Box bare>
      <ImageCarousel photos={place.photos} alt={place.name} />
    </Box>
  );
}

export function LocationBox({ place }: { place: PlaceDetail }) {
  const mapsUrl =
    place.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(place.address)}`;
  const uberUrl = buildUberDropoffUrl(place);
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="#ec4899"
      right={formatDistanceKm(place.distance_km)}
    >
      <View
        className="aspect-[2/1] items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: '#1d1442' }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            ...SHADOW_GLOW,
          }}
        >
          <MapPin color="#fff" fill="#fff" size={16} strokeWidth={1.5} />
        </LinearGradient>
        <View className="mt-1.5 max-w-[90%] rounded-full bg-black/80 px-2.5 py-0.5">
          <Text className="text-[11px] font-medium text-white" numberOfLines={1}>
            {place.name}
          </Text>
        </View>
      </View>
      <Text className="text-xs leading-snug text-muted-foreground">
        {place.address}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => void Linking.openURL(mapsUrl)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2.5"
        >
          <MapPin color="#78350f" size={14} />
          <Text className="text-xs font-semibold text-amber-950">
            Google Maps
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(uberUrl)}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-zinc-300/70 bg-zinc-100 px-3 py-2.5"
        >
          <Bike color="#18181b" size={14} />
          <Text className="text-xs font-semibold text-zinc-900">Ask Uber</Text>
        </Pressable>
      </View>
    </Box>
  );
}

function todayWeekdayLabel(tz: string | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      weekday: 'long',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
      new Date(),
    );
  }
}

export function HoursBox({ place }: { place: PlaceDetail }) {
  const today = todayWeekdayLabel(place.timezone);
  const statusDetail = place.open_now
    ? place.closes_at
      ? `until ${place.closes_at}`
      : null
    : place.opens_at
      ? `opens ${place.opens_at}`
      : null;
  const tz = place.timezone || undefined;

  return (
    <Box title="Time" icon={Clock} iconColor="#a78bfa" right={tz}>
      <Text className="text-xs leading-snug">
        <Text
          className={`font-semibold ${
            place.open_now ? 'text-emerald-700' : 'text-muted-foreground'
          }`}
        >
          {place.open_now ? 'Open' : 'Closed'}
        </Text>
        {statusDetail ? (
          <Text className="text-foreground/80"> · {statusDetail}</Text>
        ) : null}
      </Text>
      {place.hours_table.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-border">
          {place.hours_table.map((row) => {
            const isToday = row.day === today;
            const closed = row.range.toLowerCase() === 'closed';
            return (
              <View
                key={row.day}
                className={`flex-row items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0 ${
                  isToday ? 'bg-violet-50/80' : ''
                }`}
              >
                <Text
                  className={`shrink-0 text-xs font-semibold ${
                    isToday ? 'text-violet-800' : 'text-foreground'
                  }`}
                >
                  {row.day}
                </Text>
                <Text
                  className={`min-w-0 flex-1 text-right text-xs tabular-nums ${
                    closed
                      ? 'text-muted-foreground'
                      : isToday
                        ? 'font-semibold text-violet-950'
                        : 'text-foreground/85'
                  }`}
                  numberOfLines={1}
                >
                  {row.range}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Box>
  );
}
