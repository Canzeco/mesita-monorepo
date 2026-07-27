import { LinearGradient } from 'expo-linear-gradient';
import { Gift } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { isElevatedClass } from '@/lib/consumer-classes';
import { resolvePromoRateFromPlaceRow } from '@/lib/promo-rates';
import { useAuth } from '@/providers/auth';

export function PromoChip({
  place,
  size = 'sm',
  showWhenEmpty = false,
}: {
  place: Place;
  size?: 'sm' | 'md';
  showWhenEmpty?: boolean;
}) {
  const { consumerClass } = useAuth();
  const classKey = consumerClass?.key ?? 'standard';
  const isFirstVisit = place.is_first_visit !== false;
  const promoPercent = resolvePromoRateFromPlaceRow(
    place as unknown as Record<string, unknown>,
    isFirstVisit,
    isElevatedClass(classKey),
  );
  const textSize = size === 'md' ? 'text-[11.5px]' : 'text-[10.5px]';
  const iconSize = size === 'md' ? 12 : 10;

  if (promoPercent == null) {
    if (!showWhenEmpty) return null;
    return (
      <View className="flex-row items-center gap-1.5 rounded-md border border-white/35 bg-black/45 px-2.5 py-1">
        <Gift color="#fff" size={iconSize} />
        <Text className={`${textSize} font-semibold text-white`}>
          No Reward for You
        </Text>
      </View>
    );
  }

  return (
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
      <Gift color="#fff" size={iconSize} />
      <Text className={`${textSize} font-semibold text-white`}>
        {promoPercent}% OFF {isFirstVisit ? 'welcome' : 'return-visit'} discount
      </Text>
    </LinearGradient>
  );
}
