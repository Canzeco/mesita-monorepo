import { Star } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';

export function StarRatingRow({
  label,
  value,
  onChange,
  size = 'compact',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  size?: 'hero' | 'compact';
}) {
  const starSize = size === 'hero' ? 32 : 24;
  const isHero = size === 'hero';

  return (
    <View
      style={
        isHero
          ? { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }
          : {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
            }
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 8,
          ...(isHero ? {} : { flexShrink: 1 }),
        }}
      >
        <Text
          style={{
            fontWeight: isHero ? '800' : '600',
            fontSize: isHero ? 14 : 13,
            color: COLORS.foreground,
          }}
        >
          {label}
        </Text>
        {value > 0 ? (
          <Text
            style={{
              color: COLORS.mutedForeground,
              fontSize: 11,
              fontVariant: ['tabular-nums'],
            }}
          >
            {value}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          ...(isHero
            ? { justifyContent: 'space-between', width: '100%' }
            : { gap: 2, flexShrink: 0 }),
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value >= n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityLabel={`${label}: ${n} star${n === 1 ? '' : 's'}`}
              hitSlop={4}
              style={{
                alignItems: 'center',
                paddingVertical: 2,
                paddingHorizontal: isHero ? 0 : 1,
                ...(isHero ? { flex: 1 } : {}),
              }}
            >
              <Star
                size={starSize}
                color={on ? COLORS.foreground : 'rgba(93,93,93,0.35)'}
                fill={on ? COLORS.foreground : 'transparent'}
                strokeWidth={on ? 0 : 1.5}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
