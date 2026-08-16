import type { ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
//
// Pills are content-width inside a horizontal scroller (web parity): five
// icon+label pills can't share a phone-width row without truncating the longest
// label, so the tail scrolls instead of squeezing.
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
    <ScrollView
      accessibilityRole="tablist"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: 'center', gap: 6 }}
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
            className="min-h-[44px]"
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
                  ? 'min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2'
                  : 'min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2'
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
    </ScrollView>
  );
}
