import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { COLORS, GRADIENT_DIAGONAL } from '@/constants/brand';

export type DiscountLevel = 'LOW' | 'HIGH' | 'EXTRA' | 'MAX';

// THE LADDER IS ONE INK RAMP, NOT FOUR HUES (MESITA-1954). The rungs used to
// borrow the class gradients — pink, influencer, premium and a loose amber —
// so a token-only repaint would have greyed LOW and EXTRA while HIGH stayed
// blue and MAX stayed amber: the SMALLEST discount reading as "different"
// instead of "least". The tier's own colour is already on this card, in
// ClimbCard's icon tile, so the meter is free to do the one job left to it —
// magnitude. Four rungs, one ramp, each step ~15 L* darker than the last and
// every one of them well clear of the unfilled track. The `filled` count and
// the level word stay the primary carriers; the ramp only agrees with them.
const LEVEL_META: Record<
  DiscountLevel,
  { filled: number; colors: readonly [string, string] }
> = {
  LOW: { filled: 1, colors: ['#a3a3a3', '#8a8a8a'] },
  HIGH: { filled: 2, colors: ['#7a7a7a', COLORS.mutedForeground] },
  EXTRA: { filled: 3, colors: ['#525252', COLORS.secondary] },
  MAX: { filled: 4, colors: ['#2e2e2e', COLORS.foreground] },
};

/** Qualitative LOW→MAX discount ladder — hero signal on Class climb cards. */
export function DiscountMeter({ level }: { level: DiscountLevel }) {
  const { filled, colors } = LEVEL_META[level];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Discount Rewards level: ${level} (${filled} of 4)`}
      style={{
        backgroundColor: COLORS.muted,
        borderRadius: 12,
        padding: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 0.4,
            color: COLORS.foreground,
          }}
        >
          {level}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: COLORS.mutedForeground,
          }}
        >
          Discount Rewards
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4].map((i) =>
          i <= filled ? (
            <LinearGradient
              key={i}
              colors={[...colors]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{ flex: 1, height: 8, borderRadius: 999 }}
            />
          ) : (
            <View
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 999,
                backgroundColor: COLORS.border,
              }}
            />
          ),
        )}
      </View>
    </View>
  );
}
