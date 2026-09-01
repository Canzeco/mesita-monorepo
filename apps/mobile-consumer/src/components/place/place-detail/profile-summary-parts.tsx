import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Star } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ChannelMark } from '@/components/brand/channel-marks';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { isElevatedClass } from '@/lib/consumer-classes';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { firstInitial } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export function ProfilePhoto({ place }: { place: PlaceDetail }) {
  return (
    <View className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-border">
      {place.photos.length > 0 ? (
        <Image
          source={{ uri: place.photos[0] }}
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
          <Text className="font-display text-3xl font-bold text-white/80">
            {firstInitial(place.name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

export function ProfileStat({
  value,
  label,
  star,
  ig,
  fb,
  gift,
}: {
  value: string;
  label: string;
  star?: boolean;
  ig?: boolean;
  fb?: boolean;
  gift?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 items-center px-0.5">
      <View className="flex-row items-center gap-0.5">
        {star ? <Star color="#f59e0b" fill="#f59e0b" size={12} /> : null}
        {ig ? <ChannelMark channel="instagram" size={12} color="#ec4899" /> : null}
        {fb ? <ChannelMark channel="facebook" size={12} color="#2563eb" /> : null}
        {gift ? <Gift color="#0ea5e9" size={12} /> : null}
        <Text className="text-[17px] font-bold tabular-nums text-foreground">
          {value}
        </Text>
      </View>
      <Text
        className="mt-0.5 text-[10px] font-medium text-muted-foreground"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function ProfileMetaChip({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
      {children}
    </View>
  );
}

export function PromoMetaChip({ place }: { place: PlaceDetail }) {
  const { consumerClass } = useAuth();
  const isElevated = isElevatedClass(consumerClass?.class ?? 'standard');
  const rate = resolvePromoRateFromPlaceRow(
    {
      listing_type: place.listing_type,
      welcome_free_rate: place.promo_matrix.welcome.free,
      welcome_premium_rate: place.promo_matrix.welcome.premium,
      free_rate: place.promo_matrix.default.free,
      premium_rate: place.promo_matrix.default.premium,
      is_first_visit: place.promo_matrix.is_first_visit,
    },
    place.promo_matrix.is_first_visit,
    isElevated,
  );
  return (
    <ProfileMetaChip>
      <Gift color={rate != null ? '#0ea5e9' : '#775254'} size={12} />
      <Text className="text-[11.5px] font-semibold text-foreground">
        {rate != null ? `${rate}% off` : 'No reward'}
      </Text>
    </ProfileMetaChip>
  );
}
