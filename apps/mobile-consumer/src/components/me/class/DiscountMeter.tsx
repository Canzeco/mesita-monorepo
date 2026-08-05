import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

export type DiscountLevel = 'LOW' | 'HIGH' | 'EXTRA' | 'MAX';

const LEVEL_META: Record<
  DiscountLevel,
  { filled: number; colors: readonly [string, string] }
> = {
  LOW: { filled: 1, colors: GRADIENTS.pink },
  HIGH: { filled: 2, colors: GRADIENTS.sky },
  EXTRA: { filled: 3, colors: GRADIENTS.premium },
  MAX: { filled: 4, colors: ['#f59e0b', '#fbbf24'] },
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
        backgroundColor: '#faeff0',
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
            color: '#260409',
          }}
        >
          {level}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: '#775254',
          }}
        >
          Discount
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
                backgroundColor: '#e5d4d6',
              }}
            />
          ),
        )}
      </View>
    </View>
  );
}
