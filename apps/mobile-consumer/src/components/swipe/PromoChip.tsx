import { LinearGradient } from 'expo-linear-gradient';
import { Gift } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
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
        {/* MESITA-1954: hue was the ONLY thing separating this from the
            discount ribbon below (hairline chip vs pink gradient), and
            GRADIENTS.pink is the ink ramp now — greyscaled blind, the two
            opposite answers to "does this guest get a discount here" would
            read as one dark chip on a photo. They diverge by SHAPE and
            WEIGHT instead: "no reward" keeps the translucent, OUTLINED chip
            every passive meta state wears, and its gift stays HOLLOW at the
            0.7 white of a state nobody has to act on. */}
        <Gift color="rgba(255,255,255,0.7)" size={iconSize} />
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
      {/* The affirmative, and the only chip here that is OPAQUE, border-less
          and carries a FILLED glyph. That trio — not colour — is what keeps a
          discount unmissable now that the gradient is ink. */}
      <Gift
        color={COLORS.primaryForeground}
        fill="rgba(255,255,255,0.4)"
        size={iconSize}
      />
      <Text className={`${textSize} font-semibold text-white`}>
        Up to {promoPercent}% Discount for You
      </Text>
    </LinearGradient>
  );
}
