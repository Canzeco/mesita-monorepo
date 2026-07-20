import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { COLORS, SHADOW_GLOW } from '@/constants/brand';
import { useReduceMotion } from '@/lib/useReduceMotion';

export type SegmentItem = {
  key: string;
  title: string;
  Icon?: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  // Parked tab: visible + tappable; parent opens a coming-soon modal.
  soon?: boolean;
};

// Pink-pill segment nav — RN port of web-consumer HomeModeNav:
// active = solid primary + shadow-glow; idle/soon = muted text only (no fill).
export function SegmentNav({
  items,
  value,
  onChange,
}: {
  items: readonly SegmentItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-center gap-1.5"
    >
      {items.map(({ key, title, Icon, soon }) => {
        const active = !soon && key === value;
        const tint = active ? COLORS.primaryForeground : COLORS.mutedForeground;

        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={soon ? undefined : { selected: active }}
            accessibilityLabel={soon ? `${title}, coming soon` : title}
            className="min-h-[44px] flex-1"
            style={({ pressed }) => [
              {
                transform: [
                  { scale: pressed && !reduceMotion ? 0.98 : 1 },
                ],
              },
              active ? SHADOW_GLOW : null,
            ]}
          >
            <View
              className={
                active
                  ? 'min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-2 py-2'
                  : 'min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full px-2 py-2'
              }
            >
              {Icon ? (
                <Icon color={tint} size={16} strokeWidth={2.2} />
              ) : null}
              <Text
                numberOfLines={1}
                className={
                  active
                    ? 'font-semibold text-primary-foreground'
                    : 'font-semibold text-muted-foreground'
                }
                style={{ fontSize: 12 }}
              >
                {title}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
